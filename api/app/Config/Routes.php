<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');
$routes->get('delete-account', 'Web\AccountDeletion::index');
$routes->post('delete-account/otp', 'Web\AccountDeletion::sendOtp');
$routes->post('delete-account', 'Web\AccountDeletion::confirm');

// Admin panel web routes
$routes->get('admin', 'Web\AdminWeb::index');
$routes->get('admin/(:any)', 'Web\AdminWeb::index');

$routes->group('api/v1', ['namespace'=>'App\Controllers\Api\V1'], static function ($routes) {
    $routes->get('health', 'AppStatus::index');
    $routes->get('app/status', 'AppStatus::index');
    $routes->get('app/config', 'AppStatus::index');
    $routes->post('feedback', 'AppStatus::feedback');
    $routes->get('content/faq', 'Content::faq');
    $routes->get('support/tickets', 'Support::tickets');
    $routes->get('support/tickets/(:num)', 'Support::ticketDetail/$1');
    $routes->post('support/tickets/(:num)/reply', 'Support::reply/$1');

    $routes->post('auth/register', 'Auth::register');
    $routes->post('auth/login', 'Auth::login');
    $routes->post('auth/logout', 'Auth::logout');
    $routes->post('auth/otp/send', 'Auth::otpSend');
    $routes->post('auth/otp/verify', 'Auth::otpVerify');
    $routes->post('auth/password/reset', 'Auth::passwordReset');
    $routes->post('auth/password/change', 'Auth::passwordChange');

    $routes->get('me', 'Profile::me');
    $routes->put('me', 'Profile::update');
    $routes->post('me/avatar', 'Profile::avatar');
    $routes->get('me/avatar', 'Profile::avatarGet');
    $routes->post('me/phone/change', 'Profile::phoneChange');
    $routes->get('me/sessions', 'Profile::sessions');
    $routes->delete('me/sessions/(:any)', 'Profile::sessionDelete/$1');
    $routes->delete('me/sessions', 'Profile::sessionDeleteAll');
    $routes->get('me/export', 'Profile::export');
    $routes->get('me/export-zip', 'Profile::exportZip');
    $routes->delete('me', 'Profile::delete');

    $routes->post('devices/register', 'Devices::register');
    $routes->put('devices/push-token', 'Devices::pushTokenUpdate');
    $routes->delete('devices/push-token', 'Devices::pushTokenDelete');

    // In-app notifications & push tracking (SPEC 19.4 & 19.7)
    $routes->get('notifications', 'Notifications::index');
    $routes->post('notifications/read', 'Notifications::markRead');
    $routes->delete('notifications/(:num)', 'Notifications::delete/$1');
    $routes->post('push/opened', 'Notifications::opened');

    $routes->post('sync/push', 'Sync::push');
    $routes->get('sync/pull', 'Sync::pull');
    $routes->get('rates', 'Rates::index');

    // Shared books & roles
    $routes->post('books/(:any)/invite', 'Books::invite/$1');
    $routes->get('books/invitations', 'Books::invitations');
    $routes->post('books/invitations/(:any)/accept', 'Books::acceptInvitation/$1');
    $routes->post('books/invitations/(:any)/decline', 'Books::declineInvitation/$1');
    $routes->get('books/(:any)/members', 'Books::members/$1');
    $routes->delete('books/(:any)/members/(:num)', 'Books::removeMember/$1/$2');

    $routes->post('files', 'Files::upload');
    $routes->get('files/(:segment)/thumb', 'Files::thumbnail/$1');
    $routes->get('files/(:segment)', 'Files::download/$1');
    $routes->delete('files/(:segment)', 'Files::delete/$1');
    $routes->get('storage/usage', 'Files::usage');

    // Preflight must match a route or CodeIgniter 404s before the CORS filter runs.
    $routes->options('(:any)', static fn () => service('response')->setStatusCode(204));
});

// Admin REST API
$routes->group('admin-api/v1', ['namespace'=>'App\Controllers\Admin'], static function ($routes) {
    $routes->post('auth/login', 'Auth::login');
    $routes->post('auth/2fa/verify', 'Auth::verifyTwoFactor');
    $routes->post('auth/forgot', 'Auth::forgot');
    $routes->post('auth/reset', 'Auth::resetPassword');

    $routes->group('', ['filter' => 'adminauth'], static function ($routes) {
        $routes->post('auth/logout', 'Auth::logout');
        $routes->post('auth/logout-others', 'Auth::logoutOthers');
        $routes->get('auth/me', 'Auth::me');

        $routes->get('dashboard', 'Dashboard::index', ['filter' => 'adminpermission:dashboard.view']);

        $routes->get('users', 'Users::index', ['filter' => 'adminpermission:users.view']);
        $routes->get('users/(:num)', 'Users::show/$1', ['filter' => 'adminpermission:users.view']);
        $routes->post('users/(:num)/disable', 'Users::disable/$1', ['filter' => 'adminpermission:users.disable']);
        $routes->post('users/(:num)/enable', 'Users::enable/$1', ['filter' => 'adminpermission:users.edit']);
        $routes->post('users/(:num)/block', 'Users::block/$1', ['filter' => 'adminpermission:users.block']);
        $routes->post('users/(:num)/unblock', 'Users::unblock/$1', ['filter' => 'adminpermission:users.block']);
        $routes->put('users/(:num)', 'Users::update/$1', ['filter' => 'adminpermission:users.edit']);
        $routes->post('users/(:num)/verify-phone', 'Users::verifyPhone/$1', ['filter' => 'adminpermission:users.edit']);
        $routes->post('users/(:num)/notes', 'Users::addNote/$1', ['filter' => 'adminpermission:users.edit']);
        $routes->post('users/(:num)/quota', 'Users::setQuota/$1', ['filter' => 'adminpermission:users.edit']);
        $routes->post('users/(:num)/revoke-sessions', 'Users::revokeSessions/$1', ['filter' => 'adminpermission:users.edit']);
        $routes->delete('users/(:num)', 'Users::destroy/$1', ['filter' => 'adminpermission:users.delete']);

        $routes->get('devices/suspicious', 'Devices::suspicious', ['filter' => 'adminpermission:devices.view']);
        $routes->get('devices', 'Devices::index', ['filter' => 'adminpermission:devices.view']);
        $routes->post('devices/(:num)/block', 'Devices::block/$1', ['filter' => 'adminpermission:devices.block']);
        $routes->post('devices/(:num)/unblock', 'Devices::unblock/$1', ['filter' => 'adminpermission:devices.block']);

        $routes->get('blocklist', 'Blocklist::index', ['filter' => 'adminpermission:blocklist.manage']);
        $routes->post('blocklist', 'Blocklist::store', ['filter' => 'adminpermission:blocklist.manage']);
        $routes->delete('blocklist/(:num)', 'Blocklist::delete/$1', ['filter' => 'adminpermission:blocklist.manage']);

        $routes->get('config', 'AppConfig::index', ['filter' => 'adminpermission:app_config.manage']);
        $routes->post('config', 'AppConfig::update', ['filter' => 'adminpermission:app_config.manage']);

        $routes->get('announcements', 'Announcements::index', ['filter' => 'adminpermission:announcements.manage']);
        $routes->post('announcements', 'Announcements::store', ['filter' => 'adminpermission:announcements.manage']);
        $routes->put('announcements/(:num)', 'Announcements::update/$1', ['filter' => 'adminpermission:announcements.manage']);
        $routes->delete('announcements/(:num)', 'Announcements::delete/$1', ['filter' => 'adminpermission:announcements.manage']);

        $routes->get('support', 'Support::index', ['filter' => 'adminpermission:support.view']);
        $routes->get('support/(:num)', 'Support::show/$1', ['filter' => 'adminpermission:support.view']);
        $routes->post('support/(:num)/reply', 'Support::reply/$1', ['filter' => 'adminpermission:support.reply']);
        $routes->put('support/(:num)/status', 'Support::updateStatus/$1', ['filter' => 'adminpermission:support.reply']);

        $routes->get('content/faq', 'Content::faqIndex', ['filter' => 'adminpermission:content.manage']);
        $routes->post('content/faq', 'Content::faqStore', ['filter' => 'adminpermission:content.manage']);
        $routes->put('content/faq/(:num)', 'Content::faqUpdate/$1', ['filter' => 'adminpermission:content.manage']);
        $routes->delete('content/faq/(:num)', 'Content::faqDelete/$1', ['filter' => 'adminpermission:content.manage']);

        $routes->get('storage', 'Storage::index', ['filter' => 'adminpermission:files.view']);
        $routes->post('storage/cleanup', 'Storage::cleanup', ['filter' => 'adminpermission:files.view']);

        $routes->get('push', 'Push::index', ['filter' => 'adminpermission:push.view']);
        $routes->post('push/estimate', 'Push::estimate', ['filter' => 'adminpermission:push.send']);
        $routes->post('push', 'Push::store', ['filter' => 'adminpermission:push.send']);
        $routes->post('push/(:num)/cancel', 'Push::cancel/$1', ['filter' => 'adminpermission:push.send']);
        $routes->post('push/(:num)/duplicate', 'Push::duplicate/$1', ['filter' => 'adminpermission:push.send']);
        $routes->post('push/templates', 'Push::saveTemplate', ['filter' => 'adminpermission:push.send']);
        $routes->post('push/automations', 'Push::saveAutomation', ['filter' => 'adminpermission:push.automations']);
        $routes->post('push/image', 'Push::uploadImage', ['filter' => 'adminpermission:push.send']);

        $routes->get('sms', 'Sms::index', ['filter' => 'adminpermission:sms.view']);
        $routes->post('sms/test', 'Sms::test', ['filter' => 'adminpermission:sms.manage']);

        $routes->get('security', 'SecurityCenter::index', ['filter' => 'adminpermission:security.view']);
        $routes->delete('security/sessions/(:num)', 'SecurityCenter::revokeSession/$1', ['filter' => 'adminpermission:security.view']);

        $routes->get('settings', 'Settings::index', ['filter' => 'adminpermission:settings.manage']);
        $routes->post('settings', 'Settings::update', ['filter' => 'adminpermission:settings.manage']);
        $routes->post('settings/firebase', 'Settings::uploadFirebase', ['filter' => 'adminpermission:settings.manage']);

        $routes->get('system/health', 'System::health', ['filter' => 'adminpermission:system.view']);
        $routes->post('system/retry', 'System::retryFailed', ['filter' => 'adminpermission:system.view']);
        $routes->get('audit', 'Audit::index', ['filter' => 'adminpermission:audit.view']);

        $routes->get('admins', 'Admins::index', ['filter' => 'adminpermission:admins.manage']);
        $routes->post('admins', 'Admins::store', ['filter' => 'adminpermission:admins.manage']);
        $routes->put('admins/(:num)', 'Admins::update/$1', ['filter' => 'adminpermission:admins.manage']);
        $routes->delete('admins/(:num)', 'Admins::delete/$1', ['filter' => 'adminpermission:admins.manage']);
        $routes->put('roles/(:segment)', 'Roles::update/$1', ['filter' => 'adminpermission:roles.manage']);
    });
});
