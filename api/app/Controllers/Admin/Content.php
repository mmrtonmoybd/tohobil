<?php

namespace App\Controllers\Admin;

class Content extends AdminApiController
{
    public function faqIndex()
    {
        $db = db_connect();
        $items = $db->table('faq_articles')
            ->orderBy('sort_order', 'ASC')
            ->orderBy('id', 'ASC')
            ->get()
            ->getResultArray();

        return $this->ok([
            'status' => 'ok',
            'data'   => $items,
        ]);
    }

    public function faqStore()
    {
        $input = $this->input();
        $titleEn = trim((string)($input['title_en'] ?? ''));
        $titleBn = trim((string)($input['title_bn'] ?? ''));
        $contentEn = trim((string)($input['content_en'] ?? ''));
        $contentBn = trim((string)($input['content_bn'] ?? ''));

        if (!$titleEn || !$titleBn || !$contentEn || !$contentBn) {
            return $this->fail('VALIDATION_ERROR', 'All title and content fields (EN & BN) are required', 422);
        }

        $db = db_connect();
        $id = $db->table('faq_articles')->insert([
            'category'     => trim((string)($input['category'] ?? 'general')),
            'title_en'     => $titleEn,
            'title_bn'     => $titleBn,
            'content_en'   => $contentEn,
            'content_bn'   => $contentBn,
            'sort_order'   => (int)($input['sort_order'] ?? 0),
            'is_published' => !empty($input['is_published']) ? 1 : 0,
            'created_at'   => date('Y-m-d H:i:s'),
        ]);

        $this->audit('faq_created', "faq:{$id}", ['title' => $titleEn]);

        return $this->ok(['status' => 'ok', 'id' => $id, 'message' => 'FAQ article created']);
    }

    public function faqUpdate($id)
    {
        $db = db_connect();
        $input = $this->input();

        $update = [];
        if (isset($input['category'])) $update['category'] = trim((string)$input['category']);
        if (isset($input['title_en'])) $update['title_en'] = trim((string)$input['title_en']);
        if (isset($input['title_bn'])) $update['title_bn'] = trim((string)$input['title_bn']);
        if (isset($input['content_en'])) $update['content_en'] = trim((string)$input['content_en']);
        if (isset($input['content_bn'])) $update['content_bn'] = trim((string)$input['content_bn']);
        if (isset($input['sort_order'])) $update['sort_order'] = (int)$input['sort_order'];
        if (isset($input['is_published'])) $update['is_published'] = (int)(bool)$input['is_published'];

        if (!empty($update)) {
            $db->table('faq_articles')->where('id', (int)$id)->update($update);
            $this->audit('faq_updated', "faq:{$id}", $update);
        }

        return $this->ok(['status' => 'ok', 'message' => 'FAQ article updated']);
    }

    public function faqDelete($id)
    {
        $db = db_connect();
        $db->table('faq_articles')->where('id', (int)$id)->delete();
        $this->audit('faq_deleted', "faq:{$id}");
        return $this->ok(['status' => 'ok', 'message' => 'FAQ article deleted']);
    }
}
