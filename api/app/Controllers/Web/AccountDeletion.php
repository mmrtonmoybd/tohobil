<?php

namespace App\Controllers\Web;

use App\Controllers\BaseController;
use App\Services\Identity;

class AccountDeletion extends BaseController
{
    protected $helpers = ['form', 'url'];

    public function index()
    {
        return view('web/delete_account', [
            'title'    => 'Delete Tohobil Account · অ্যাকাউন্ট মোছা',
            'phone'    => $this->request->getGet('phone') ?? '',
            'otpSent'  => (bool)$this->request->getGet('otp_sent'),
            'error'    => session()->getFlashdata('error'),
            'success'  => session()->getFlashdata('success'),
        ]);
    }

    public function sendOtp()
    {
        $phoneInput = (string)($this->request->getPost('phone') ?? '');
        session()->setFlashdata('error', 'Text-message codes are turned off. Enter your password to delete the account.');
        return redirect()->to('/delete-account?phone=' . urlencode($phoneInput));
    }

    public function confirm()
    {
        $phoneInput = (string)($this->request->getPost('phone') ?? '');
        $phone = Identity::phone($phoneInput);
        $method = (string)($this->request->getPost('auth_method') ?? 'password');
        $password = (string)($this->request->getPost('password') ?? '');

        if (!$phone) {
            session()->setFlashdata('error', 'Please enter a valid phone number.');
            return redirect()->to('/delete-account');
        }

        $db = db_connect();
        $user = $db->table('users')->where('phone', $phone)->get()->getRowArray();
        if (!$user) {
            session()->setFlashdata('error', 'No active account found for this phone number.');
            return redirect()->to('/delete-account?phone=' . urlencode($phone));
        }

        if ($method !== 'password') {
            session()->setFlashdata('error', 'Text-message codes are turned off. Enter your password to delete the account.');
            return redirect()->to('/delete-account?phone=' . urlencode($phone));
        }

        if ($password === '' || !password_verify($password, $user['password_hash'])) {
            session()->setFlashdata('error', 'Incorrect password. Please verify and try again.');
            return redirect()->to('/delete-account?phone=' . urlencode($phone));
        }

        $identity = new Identity($db);
        $identity->audit((int)$user['id'], 'web_account_deletion_requested', $this->request->getIPAddress());
        $identity->requestDeletion((int)$user['id']);

        session()->setFlashdata('success', 'Your Tohobil account is signed out and scheduled for permanent deletion in 30 days. Signing in again before then does not cancel it; contact support if this was a mistake.');
        return redirect()->to('/delete-account');
    }
}
