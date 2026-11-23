<?php

namespace App\Services;

final class AdminPermissions
{
    public const ALL = [
        'dashboard.view',
        'users.view', 'users.edit', 'users.disable', 'users.block', 'users.delete',
        'devices.view', 'devices.block', 'blocklist.manage',
        'push.view', 'push.send', 'push.send_all', 'push.automations',
        'announcements.manage', 'app_config.manage',
        'support.view', 'support.reply',
        'content.manage', 'files.view',
        'sms.view', 'sms.manage',
        'security.view', 'system.view', 'audit.view',
        'admins.manage', 'roles.manage', 'settings.manage', 'export.data',
    ];
}
