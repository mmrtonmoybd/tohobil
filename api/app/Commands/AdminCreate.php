<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

class AdminCreate extends BaseCommand
{
    protected $group       = 'Auth';
    protected $name        = 'admin:create';
    protected $description = 'Create a new administrator account';

    protected $options = [
        '--name'     => 'Admin full name',
        '--email'    => 'Admin email address',
        '--password' => 'Admin password (min 12 characters)',
        '--role'     => 'Role slug (super_admin, admin, support, marketing, viewer)',
    ];

    public function run(array $params)
    {
        $name     = $params['name'] ?? CLI::getOption('name') ?? ($params[0] ?? null);
        $email    = $params['email'] ?? CLI::getOption('email') ?? ($params[1] ?? null);
        $password = $params['password'] ?? CLI::getOption('password') ?? ($params[2] ?? null);
        $role     = $params['role'] ?? CLI::getOption('role') ?? ($params[3] ?? 'super_admin');

        if (!$name) {
            $name = CLI::prompt('Admin Name', null, 'required|min_length[2]');
        }
        if (!$email) {
            $email = CLI::prompt('Admin Email', null, 'required|valid_email');
        }
        if (!$password) {
            $password = CLI::promptByKey('Admin Password (min 12 chars)', [
                'required' => true,
                'min_length' => 12,
            ]);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen((string)$password) < 12) {
            CLI::error('A valid email and password of at least 12 characters are required.');
            return;
        }

        $db = db_connect();

        // Validate unique email
        $existing = $db->table('admins')->where('email', strtolower(trim((string)$email)))->get()->getRowArray();
        if ($existing) {
            CLI::error("Admin with email {$email} already exists.");
            return;
        }

        // Validate role exists
        $roleRow = $db->table('admin_roles')->where('slug', $role)->get()->getRowArray();
        if (!$roleRow) {
            CLI::error('Unknown admin role.');
            return;
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);

        $db->table('admins')->insert([
            'name'          => trim((string)$name),
            'email'         => strtolower(trim((string)$email)),
            'password_hash' => $hash,
            'role'          => $role,
            'status'        => 'active',
            'created_at'    => date('Y-m-d H:i:s'),
        ]);

        CLI::write("Admin account created successfully: {$email} ({$role})", 'green');
    }
}
