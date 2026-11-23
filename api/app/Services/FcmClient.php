<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Exception\Messaging\NotFound;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;

/** Sends data-only FCM HTTP v1 messages. Missing credentials are a failure, never success. */
class FcmClient
{
    private BaseConnection $db;
    private string $credentialsPath;
    private ?Messaging $messaging;

    public function __construct(?BaseConnection $db = null, ?string $credentialsPath = null, ?Messaging $messaging = null)
    {
        $this->db = $db ?? db_connect();
        $this->credentialsPath = $credentialsPath ?? WRITEPATH . 'firebase/service-account.json';
        $this->messaging = $messaging;
    }

    public function hasCredentials(): bool
    {
        $config = $this->readCredentials();
        return $config !== null && ($config['type'] ?? '') === 'service_account'
            && !empty($config['project_id']) && !empty($config['client_email']) && !empty($config['private_key']);
    }

    private function readCredentials(): ?array
    {
        if (!is_file($this->credentialsPath) || !is_readable($this->credentialsPath)) return null;
        $data = json_decode((string) file_get_contents($this->credentialsPath), true);
        return is_array($data) ? $data : null;
    }

    public function getServiceAccountInfo(): ?array
    {
        if (!$this->hasCredentials()) return null;
        $data = $this->readCredentials();
        return ['project_id' => $data['project_id'], 'client_email' => $data['client_email'], 'private_key_id' => substr((string)($data['private_key_id'] ?? ''), 0, 8) . '...'];
    }

    private function client(): ?Messaging
    {
        if ($this->messaging) return $this->messaging;
        if (!$this->hasCredentials()) return null;
        $this->messaging = (new Factory())->withServiceAccount($this->credentialsPath)->createMessaging();
        return $this->messaging;
    }

    private function payload(string $title, string $body, array $data): ?array
    {
        $payload = ['title' => $title, 'body' => $body];
        foreach ($data as $key => $value) {
            if (!is_scalar($value) && $value !== null) return null;
            $payload[(string)$key] = (string)($value ?? '');
        }
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE);
        return $encoded !== false && strlen($encoded) <= 4000 ? $payload : null;
    }

    public function sendToToken(string $token, string $title, string $body, array $data = []): array
    {
        if ($token === '') return ['ok' => false, 'error' => 'EMPTY_TOKEN'];
        $payload = $this->payload($title, $body, $data);
        if ($payload === null) return ['ok' => false, 'error' => 'INVALID_PAYLOAD'];
        if (!$client = $this->client()) return ['ok' => false, 'error' => 'FCM_NOT_CONFIGURED'];
        try {
            $result = $client->send(CloudMessage::new()->toToken($token)->withData($payload));
            return ['ok' => true, 'message_id' => $result['name'] ?? null];
        } catch (NotFound $e) {
            $this->clearInvalidTokens([$token]);
            return ['ok' => false, 'error' => 'UNREGISTERED'];
        } catch (\Throwable $e) {
            log_message('error', 'FCM token send failed: {type}', ['type' => get_class($e)]);
            return ['ok' => false, 'error' => 'FCM_SEND_FAILED'];
        }
    }

    public function sendToTopic(string $topic, string $title, string $body, array $data = []): array
    {
        if (!preg_match('/^[a-zA-Z0-9_\-\.~%]{1,900}$/', $topic)) return ['ok' => false, 'error' => 'INVALID_TOPIC'];
        $payload = $this->payload($title, $body, $data);
        if ($payload === null) return ['ok' => false, 'error' => 'INVALID_PAYLOAD'];
        if (!$client = $this->client()) return ['ok' => false, 'error' => 'FCM_NOT_CONFIGURED'];
        try {
            $result = $client->send(CloudMessage::new()->toTopic($topic)->withData($payload));
            return ['ok' => true, 'topic' => $topic, 'message_id' => $result['name'] ?? null];
        } catch (\Throwable $e) {
            log_message('error', 'FCM topic send failed: {type}', ['type' => get_class($e)]);
            return ['ok' => false, 'error' => 'FCM_SEND_FAILED'];
        }
    }

    public function sendBatch(array $tokens, string $title, string $body, array $data = []): array
    {
        $tokens = array_slice(array_values(array_unique(array_filter($tokens, static fn($v) => is_string($v) && $v !== ''))), 0, 500);
        $total = count($tokens);
        if (!$total) return ['total' => 0, 'success' => 0, 'failed' => 0, 'invalid' => 0];
        $payload = $this->payload($title, $body, $data);
        if ($payload === null || !($client = $this->client())) return ['total' => $total, 'success' => 0, 'failed' => $total, 'invalid' => 0, 'error' => $payload === null ? 'INVALID_PAYLOAD' : 'FCM_NOT_CONFIGURED'];
        try {
            $report = $client->sendMulticast(CloudMessage::new()->withData($payload), $tokens);
            $invalid = array_values(array_unique(array_merge($report->invalidTokens(), $report->unknownTokens())));
            $this->clearInvalidTokens($invalid);
            return ['total' => $total, 'success' => count($report->successes()), 'failed' => count($report->failures()), 'invalid' => count($invalid)];
        } catch (\Throwable $e) {
            log_message('error', 'FCM batch send failed: {type}', ['type' => get_class($e)]);
            return ['total' => $total, 'success' => 0, 'failed' => $total, 'invalid' => 0, 'error' => 'FCM_SEND_FAILED'];
        }
    }

    /** Per-token result used by the durable push queue. */
    public function sendBatchDetailed(array $tokens, string $title, string $body, array $data = []): array
    {
        $tokens = array_slice(array_values(array_unique(array_filter($tokens, static fn($v) => is_string($v) && $v !== ''))), 0, 500);
        if (!$tokens) return [];
        $payload = $this->payload($title, $body, $data);
        $client = $payload === null ? null : $this->client();
        if ($client === null) return array_fill_keys($tokens, ['ok' => false, 'invalid' => false, 'error' => $payload === null ? 'INVALID_PAYLOAD' : 'FCM_NOT_CONFIGURED']);
        try {
            $report = $client->sendMulticast(CloudMessage::new()->withData($payload), $tokens);
            $result = [];
            $invalid = [];
            foreach ($report->getItems() as $item) {
                $token = $item->target()->value();
                $isInvalid = $item->messageTargetWasInvalid() || $item->messageWasSentToUnknownToken();
                $result[$token] = ['ok' => $item->isSuccess(), 'invalid' => $isInvalid, 'error' => $item->isSuccess() ? null : ($isInvalid ? 'UNREGISTERED' : 'FCM_SEND_FAILED')];
                if ($isInvalid) $invalid[] = $token;
            }
            $this->clearInvalidTokens($invalid);
            return $result;
        } catch (\Throwable $e) {
            log_message('error', 'FCM detailed batch failed: {type}', ['type' => get_class($e)]);
            return array_fill_keys($tokens, ['ok' => false, 'invalid' => false, 'error' => 'FCM_SEND_FAILED']);
        }
    }

    private function clearInvalidTokens(array $tokens): void
    {
        if ($tokens && $this->db->tableExists('devices')) $this->db->table('devices')->whereIn('push_token', $tokens)->update(['push_token' => null]);
    }
}
