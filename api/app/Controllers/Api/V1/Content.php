<?php

namespace App\Controllers\Api\V1;

class Content extends ApiController
{
    public function faq()
    {
        $db = db_connect();
        $lang = $this->request->getGet('lang') ?: 'en';

        $rows = $db->table('faq_articles')
            ->where('is_published', 1)
            ->orderBy('sort_order', 'ASC')
            ->orderBy('id', 'ASC')
            ->get()
            ->getResultArray();

        $items = [];
        foreach ($rows as $r) {
            $items[] = [
                'id'       => (int)$r['id'],
                'category' => $r['category'],
                'title'    => ($lang === 'bn') ? $r['title_bn'] : $r['title_en'],
                'content'  => ($lang === 'bn') ? $r['content_bn'] : $r['content_en'],
            ];
        }

        return $this->response->setJSON([
            'status' => 'ok',
            'data'   => $items,
        ]);
    }
}
