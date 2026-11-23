<?php

namespace App\Controllers\Web;

use App\Controllers\BaseController;

class AdminWeb extends BaseController
{
    public function index()
    {
        $indexPath = FCPATH . 'admin/index.html';
        if (file_exists($indexPath)) {
            return $this->response
                ->setContentType('text/html')
                ->setBody(file_get_contents($indexPath));
        }

        // Clean static admin UI fallback
        return view('web/admin_panel');
    }
}
