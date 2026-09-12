import test from 'node:test';
import assert from 'node:assert/strict';

// RBAC Permissions Logic under test
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [
    'users.read',
    'users.update',
    'tools.read',
    'tools.update',
    'curriculum.read',
    'curriculum.update',
    'settings.update',
    'analytics.read',
    'audit.read',
    'security.manage',
  ],
  ADMIN: [
    'users.read',
    'tools.read',
    'tools.update',
    'curriculum.read',
    'curriculum.update',
    'settings.update',
    'analytics.read',
    'audit.read',
  ],
  USER: [],
};

function hasPermission(role, permission) {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(permission);
}

function verifyAdminMutation(actor, permission) {
  if (!actor || !actor.role) {
    throw new Error('Unauthorized: Authentication required.');
  }
  if (!hasPermission(actor.role, permission)) {
    throw new Error(`Permission denied: "${permission}" is required.`);
  }
  return true;
}

function verifyRolePromotion(actor, targetRole) {
  if (actor.role !== 'SUPER_ADMIN') {
    throw new Error('Permission denied: Only SUPER_ADMIN can manage administrator roles.');
  }
  return true;
}

test('Section 38 & 39: SUPER_ADMIN possesses all centralized platform permissions', () => {
  const permissions = [
    'users.read',
    'users.update',
    'tools.read',
    'tools.update',
    'curriculum.read',
    'curriculum.update',
    'settings.update',
    'analytics.read',
    'audit.read',
    'security.manage',
  ];

  for (const perm of permissions) {
    assert.equal(hasPermission('SUPER_ADMIN', perm), true, `SUPER_ADMIN should have ${perm}`);
  }
});

test('Section 38 & 39: Standard ADMIN has restricted permissions (no security.manage or users.update)', () => {
  assert.equal(hasPermission('ADMIN', 'tools.read'), true);
  assert.equal(hasPermission('ADMIN', 'tools.update'), true);
  assert.equal(hasPermission('ADMIN', 'curriculum.read'), true);
  assert.equal(hasPermission('ADMIN', 'curriculum.update'), true);
  assert.equal(hasPermission('ADMIN', 'security.manage'), false, 'ADMIN must not have security.manage');
  assert.equal(hasPermission('ADMIN', 'users.update'), false, 'ADMIN must not have users.update');
});

test('Section 38 & 39: Regular USER has zero administrative permissions', () => {
  const permissions = [
    'users.read',
    'users.update',
    'tools.read',
    'tools.update',
    'curriculum.read',
    'curriculum.update',
    'settings.update',
    'analytics.read',
    'audit.read',
    'security.manage',
  ];

  for (const perm of permissions) {
    assert.equal(hasPermission('USER', perm), false, `USER must never have ${perm}`);
  }
  assert.equal(hasPermission(undefined, 'tools.read'), false);
});

test('Section 40 & 80: Unauthorized mutation attempts are rejected server-side', () => {
  const guestActor = null;
  const userActor = { id: 'u1', role: 'USER', email: 'student@example.com' };
  const adminActor = { id: 'a1', role: 'ADMIN', email: 'admin@example.com' };
  const superActor = { id: 's1', role: 'SUPER_ADMIN', email: 'super@example.com' };

  // Guest rejected
  assert.throws(() => verifyAdminMutation(guestActor, 'tools.update'), /Unauthorized/);

  // USER rejected from tools.update
  assert.throws(() => verifyAdminMutation(userActor, 'tools.update'), /Permission denied/);

  // ADMIN allowed for tools.update
  assert.equal(verifyAdminMutation(adminActor, 'tools.update'), true);

  // ADMIN rejected from security.manage
  assert.throws(() => verifyAdminMutation(adminActor, 'security.manage'), /Permission denied/);

  // SUPER_ADMIN allowed for security.manage
  assert.equal(verifyAdminMutation(superActor, 'security.manage'), true);
});

test('Section 41: Self-promotion and role management restrictions', () => {
  const adminActor = { id: 'a1', role: 'ADMIN', email: 'admin@example.com' };
  const superActor = { id: 's1', role: 'SUPER_ADMIN', email: 'super@example.com' };

  // Normal ADMIN cannot promote themselves or anyone else
  assert.throws(() => verifyRolePromotion(adminActor, 'SUPER_ADMIN'), /Only SUPER_ADMIN/);

  // SUPER_ADMIN is authorized
  assert.equal(verifyRolePromotion(superActor, 'ADMIN'), true);
  assert.equal(verifyRolePromotion(superActor, 'SUPER_ADMIN'), true);
});

test('Configured Super Admin: muttuhangaragi161@gmail.com has full SUPER_ADMIN authority', () => {
  const muttuAdmin = {
    id: 'admin_muttu_super',
    email: 'muttuhangaragi161@gmail.com',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
  };

  assert.equal(muttuAdmin.role, 'SUPER_ADMIN');
  assert.equal(verifyAdminMutation(muttuAdmin, 'security.manage'), true);
  assert.equal(verifyAdminMutation(muttuAdmin, 'tools.update'), true);
  assert.equal(verifyAdminMutation(muttuAdmin, 'curriculum.update'), true);
  assert.equal(verifyRolePromotion(muttuAdmin, 'SUPER_ADMIN'), true);
});
