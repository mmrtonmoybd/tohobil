<?php

use App\Services\Identity;
use CodeIgniter\Test\CIUnitTestCase;

final class IdentityTest extends CIUnitTestCase
{
    public function testBanglaAndLocalPhoneNormalization(): void
    {
        self::assertSame('+8801712345678', Identity::phone('০১৭১২৩৪৫৬৭৮'));
        self::assertSame('+8801712345678', Identity::phone('01712-345678'));
        self::assertNull(Identity::phone('123'));
    }

    public function testIpv4AndIpv6CidrMatching(): void
    {
        self::assertTrue(Identity::inCidr('192.168.1.12','192.168.1.0/24'));
        self::assertFalse(Identity::inCidr('192.168.2.12','192.168.1.0/24'));
        self::assertTrue(Identity::inCidr('2001:db8::10','2001:db8::/32'));
        self::assertFalse(Identity::inCidr('2001:db9::10','2001:db8::/32'));
        self::assertFalse(Identity::inCidr('192.168.1.1','192.168.1.0/80'));
    }
}
