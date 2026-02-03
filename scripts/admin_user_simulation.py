"""
Admin User Management Simulation
================================
Tests the logic for admin user management before implementing in TypeScript.

Run: python scripts/admin_user_simulation.py
"""

import hashlib
import secrets
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

# =============================================================================
# CONFIGURATION
# =============================================================================

ALLOWED_EMAIL_DOMAINS = ['octup.com', 'test.com']  # Configurable
DEFAULT_PASSWORD = 'Octup@2026!'
PASSWORD_REGEX = r'^(?=.*[A-Z])(?=.*\d).{8,}$'  # Min 8 chars, 1 uppercase, 1 number


# =============================================================================
# ENUMS & DATA CLASSES
# =============================================================================

class UserRole(Enum):
    SUPER_ADMIN = 'super_admin'
    ADMIN = 'admin'


class AuditAction(Enum):
    USER_CREATED = 'user_created'
    USER_UPDATED = 'user_updated'
    USER_DEACTIVATED = 'user_deactivated'
    USER_ACTIVATED = 'user_activated'
    PASSWORD_RESET = 'password_reset'
    LOGIN_SUCCESS = 'login_success'
    LOGIN_FAILED = 'login_failed'


@dataclass
class AdminUser:
    user_id: str
    email: str
    name: str
    password_hash: str
    must_change_password: bool
    role: UserRole
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None


@dataclass
class AuditLog:
    log_id: str
    action: AuditAction
    actor_id: str  # Who performed the action
    target_id: Optional[str]  # Who was affected (for user actions)
    details: Dict[str, Any]
    timestamp: datetime


# =============================================================================
# IN-MEMORY DATABASE (Simulates BigQuery/Mock)
# =============================================================================

class Database:
    def __init__(self):
        self.users: Dict[str, AdminUser] = {}
        self.audit_logs: List[AuditLog] = []

    def get_user_by_id(self, user_id: str) -> Optional[AdminUser]:
        return self.users.get(user_id)

    def get_user_by_email(self, email: str) -> Optional[AdminUser]:
        email_lower = email.lower()
        for user in self.users.values():
            if user.email.lower() == email_lower:
                return user
        return None

    def get_all_users(self) -> List[AdminUser]:
        return list(self.users.values())

    def get_active_super_admins(self) -> List[AdminUser]:
        return [u for u in self.users.values()
                if u.role == UserRole.SUPER_ADMIN and u.is_active]

    def save_user(self, user: AdminUser):
        self.users[user.user_id] = user

    def add_audit_log(self, log: AuditLog):
        self.audit_logs.append(log)
        print(f"  [AUDIT] {log.action.value}: {log.details}")


# =============================================================================
# SERVICES
# =============================================================================

class PasswordService:
    """Handles password hashing and validation"""

    @staticmethod
    def hash_password(password: str) -> str:
        """Simple hash for simulation (use bcrypt in production)"""
        return hashlib.sha256(password.encode()).hexdigest()

    @staticmethod
    def verify_password(password: str, hash: str) -> bool:
        return PasswordService.hash_password(password) == hash

    @staticmethod
    def validate_password(password: str) -> tuple[bool, Optional[str]]:
        """Validate password meets requirements"""
        if not password or len(password) < 8:
            return False, "Password must be at least 8 characters"
        if not re.match(PASSWORD_REGEX, password):
            return False, "Password must contain at least 1 uppercase letter and 1 number"
        return True, None

    @staticmethod
    def generate_temp_password() -> str:
        """Generate a temporary password"""
        return DEFAULT_PASSWORD


class ValidationService:
    """Handles input validation"""

    @staticmethod
    def validate_email_domain(email: str) -> tuple[bool, Optional[str]]:
        """Check if email domain is allowed"""
        if not email or '@' not in email:
            return False, "Invalid email format"

        domain = email.split('@')[1].lower()
        if domain not in ALLOWED_EMAIL_DOMAINS:
            allowed = ', '.join(ALLOWED_EMAIL_DOMAINS)
            return False, f"Email domain not allowed. Allowed domains: {allowed}"

        return True, None

    @staticmethod
    def validate_email_format(email: str) -> tuple[bool, Optional[str]]:
        """Basic email format validation"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, email):
            return False, "Invalid email format"
        return True, None


class AdminUserService:
    """Main service for admin user management"""

    def __init__(self, db: Database):
        self.db = db
        self.password_service = PasswordService()
        self.validation_service = ValidationService()

    def _generate_id(self) -> str:
        return f"user-{secrets.token_hex(8)}"

    def _log_audit(self, action: AuditAction, actor_id: str,
                   target_id: Optional[str] = None, details: Dict = None):
        log = AuditLog(
            log_id=f"log-{secrets.token_hex(8)}",
            action=action,
            actor_id=actor_id,
            target_id=target_id,
            details=details or {},
            timestamp=datetime.now()
        )
        self.db.add_audit_log(log)

    def create_user(self, actor_id: str, email: str, name: str,
                    role: UserRole = UserRole.ADMIN) -> tuple[Optional[AdminUser], Optional[str], Optional[str]]:
        """
        Create a new admin user.
        Returns: (user, temp_password, error_message)
        """
        print(f"\n[CREATE USER] Attempting to create user: {email}")

        # Validate email format
        valid, error = self.validation_service.validate_email_format(email)
        if not valid:
            print(f"  [ERROR] {error}")
            return None, None, error

        # Validate email domain
        valid, error = self.validation_service.validate_email_domain(email)
        if not valid:
            print(f"  [ERROR] {error}")
            return None, None, error

        # Check if email already exists
        existing = self.db.get_user_by_email(email)
        if existing:
            error = f"User with email {email} already exists"
            print(f"  [ERROR] {error}")
            return None, None, error

        # Generate temp password
        temp_password = self.password_service.generate_temp_password()

        # Create user
        user = AdminUser(
            user_id=self._generate_id(),
            email=email.lower(),
            name=name,
            password_hash=self.password_service.hash_password(temp_password),
            must_change_password=True,
            role=role,
            is_active=True,
            created_at=datetime.now()
        )

        self.db.save_user(user)

        # Audit log
        self._log_audit(
            AuditAction.USER_CREATED,
            actor_id,
            user.user_id,
            {'email': email, 'role': role.value, 'created_by': actor_id}
        )

        print(f"  [SUCCESS] User created: {user.user_id}")
        return user, temp_password, None

    def update_user(self, actor_id: str, user_id: str,
                    name: Optional[str] = None,
                    role: Optional[UserRole] = None) -> tuple[Optional[AdminUser], Optional[str]]:
        """
        Update user details.
        Returns: (user, error_message)
        """
        print(f"\n[UPDATE USER] Attempting to update user: {user_id}")

        user = self.db.get_user_by_id(user_id)
        if not user:
            error = "User not found"
            print(f"  [ERROR] {error}")
            return None, error

        # Prevent demoting last super_admin
        if role and role != UserRole.SUPER_ADMIN and user.role == UserRole.SUPER_ADMIN:
            super_admins = self.db.get_active_super_admins()
            if len(super_admins) <= 1:
                error = "Cannot demote the last super_admin"
                print(f"  [ERROR] {error}")
                return None, error

        changes = {}
        if name and name != user.name:
            changes['name'] = {'from': user.name, 'to': name}
            user.name = name
        if role and role != user.role:
            changes['role'] = {'from': user.role.value, 'to': role.value}
            user.role = role

        if changes:
            self.db.save_user(user)
            self._log_audit(
                AuditAction.USER_UPDATED,
                actor_id,
                user_id,
                {'changes': changes}
            )
            print(f"  [SUCCESS] User updated: {changes}")
        else:
            print(f"  [INFO] No changes made")

        return user, None

    def deactivate_user(self, actor_id: str, user_id: str) -> tuple[bool, Optional[str]]:
        """
        Deactivate a user.
        Returns: (success, error_message)
        """
        print(f"\n[DEACTIVATE USER] Attempting to deactivate user: {user_id}")

        # Cannot deactivate self
        if actor_id == user_id:
            error = "Cannot deactivate yourself"
            print(f"  [ERROR] {error}")
            return False, error

        user = self.db.get_user_by_id(user_id)
        if not user:
            error = "User not found"
            print(f"  [ERROR] {error}")
            return False, error

        if not user.is_active:
            error = "User is already deactivated"
            print(f"  [ERROR] {error}")
            return False, error

        # Prevent deactivating last super_admin
        if user.role == UserRole.SUPER_ADMIN:
            super_admins = self.db.get_active_super_admins()
            if len(super_admins) <= 1:
                error = "Cannot deactivate the last super_admin"
                print(f"  [ERROR] {error}")
                return False, error

        user.is_active = False
        self.db.save_user(user)

        self._log_audit(
            AuditAction.USER_DEACTIVATED,
            actor_id,
            user_id,
            {'email': user.email}
        )

        print(f"  [SUCCESS] User deactivated")
        return True, None

    def activate_user(self, actor_id: str, user_id: str) -> tuple[bool, Optional[str]]:
        """
        Activate a user.
        Returns: (success, error_message)
        """
        print(f"\n[ACTIVATE USER] Attempting to activate user: {user_id}")

        user = self.db.get_user_by_id(user_id)
        if not user:
            error = "User not found"
            print(f"  [ERROR] {error}")
            return False, error

        if user.is_active:
            error = "User is already active"
            print(f"  [ERROR] {error}")
            return False, error

        user.is_active = True
        self.db.save_user(user)

        self._log_audit(
            AuditAction.USER_ACTIVATED,
            actor_id,
            user_id,
            {'email': user.email}
        )

        print(f"  [SUCCESS] User activated")
        return True, None

    def reset_password(self, actor_id: str, user_id: str) -> tuple[Optional[str], Optional[str]]:
        """
        Reset user's password to default.
        Returns: (new_password, error_message)
        """
        print(f"\n[RESET PASSWORD] Attempting to reset password for: {user_id}")

        user = self.db.get_user_by_id(user_id)
        if not user:
            error = "User not found"
            print(f"  [ERROR] {error}")
            return None, error

        new_password = self.password_service.generate_temp_password()
        user.password_hash = self.password_service.hash_password(new_password)
        user.must_change_password = True
        self.db.save_user(user)

        self._log_audit(
            AuditAction.PASSWORD_RESET,
            actor_id,
            user_id,
            {'email': user.email}
        )

        print(f"  [SUCCESS] Password reset")
        return new_password, None

    def authenticate(self, email: str, password: str) -> tuple[Optional[AdminUser], Optional[str]]:
        """
        Authenticate a user.
        Returns: (user, error_message)
        """
        print(f"\n[AUTH] Attempting login for: {email}")

        user = self.db.get_user_by_email(email)

        if not user:
            print(f"  [ERROR] User not found")
            return None, "Invalid credentials"

        if not user.is_active:
            print(f"  [ERROR] User is deactivated")
            self._log_audit(
                AuditAction.LOGIN_FAILED,
                user.user_id,
                None,
                {'reason': 'account_deactivated'}
            )
            return None, "Account is deactivated"

        if not self.password_service.verify_password(password, user.password_hash):
            print(f"  [ERROR] Invalid password")
            self._log_audit(
                AuditAction.LOGIN_FAILED,
                user.user_id,
                None,
                {'reason': 'invalid_password'}
            )
            return None, "Invalid credentials"

        user.last_login_at = datetime.now()
        self.db.save_user(user)

        self._log_audit(
            AuditAction.LOGIN_SUCCESS,
            user.user_id,
            None,
            {'email': email}
        )

        print(f"  [SUCCESS] Login successful")
        if user.must_change_password:
            print(f"  [INFO] User must change password")

        return user, None


# =============================================================================
# SIMULATION TESTS
# =============================================================================

def run_simulation():
    print("=" * 60)
    print("ADMIN USER MANAGEMENT SIMULATION")
    print("=" * 60)

    # Initialize
    db = Database()
    service = AdminUserService(db)

    # Create initial super_admin
    print("\n" + "=" * 60)
    print("TEST 1: Create initial super_admin")
    print("=" * 60)

    super_admin, temp_pass, error = service.create_user(
        actor_id='system',
        email='admin@octup.com',
        name='System Admin',
        role=UserRole.SUPER_ADMIN
    )
    assert super_admin is not None, f"Failed to create super_admin: {error}"
    assert temp_pass == DEFAULT_PASSWORD
    print(f"  Temp password: {temp_pass}")

    # Test login
    print("\n" + "=" * 60)
    print("TEST 2: Test login")
    print("=" * 60)

    user, error = service.authenticate('admin@octup.com', DEFAULT_PASSWORD)
    assert user is not None, f"Login failed: {error}"
    assert user.must_change_password == True

    # Test invalid login
    print("\n" + "=" * 60)
    print("TEST 3: Test invalid login")
    print("=" * 60)

    user, error = service.authenticate('admin@octup.com', 'wrong_password')
    assert user is None
    assert error == "Invalid credentials"

    # Create regular admin
    print("\n" + "=" * 60)
    print("TEST 4: Create regular admin")
    print("=" * 60)

    admin, temp_pass, error = service.create_user(
        actor_id=super_admin.user_id,
        email='user@octup.com',
        name='Regular Admin',
        role=UserRole.ADMIN
    )
    assert admin is not None, f"Failed to create admin: {error}"

    # Test invalid email domain
    print("\n" + "=" * 60)
    print("TEST 5: Test invalid email domain")
    print("=" * 60)

    user, _, error = service.create_user(
        actor_id=super_admin.user_id,
        email='user@gmail.com',
        name='External User',
        role=UserRole.ADMIN
    )
    assert user is None
    assert "domain not allowed" in error.lower()

    # Test duplicate email
    print("\n" + "=" * 60)
    print("TEST 6: Test duplicate email")
    print("=" * 60)

    user, _, error = service.create_user(
        actor_id=super_admin.user_id,
        email='admin@octup.com',
        name='Duplicate Admin',
        role=UserRole.ADMIN
    )
    assert user is None
    assert "already exists" in error.lower()

    # Update user
    print("\n" + "=" * 60)
    print("TEST 7: Update user")
    print("=" * 60)

    updated, error = service.update_user(
        actor_id=super_admin.user_id,
        user_id=admin.user_id,
        name='Updated Admin Name',
        role=UserRole.SUPER_ADMIN
    )
    assert updated is not None
    assert updated.name == 'Updated Admin Name'
    assert updated.role == UserRole.SUPER_ADMIN

    # Deactivate user
    print("\n" + "=" * 60)
    print("TEST 8: Deactivate user")
    print("=" * 60)

    success, error = service.deactivate_user(
        actor_id=super_admin.user_id,
        user_id=admin.user_id
    )
    assert success == True

    # Test login with deactivated account
    print("\n" + "=" * 60)
    print("TEST 9: Test login with deactivated account")
    print("=" * 60)

    user, error = service.authenticate('user@octup.com', DEFAULT_PASSWORD)
    assert user is None
    assert "deactivated" in error.lower()

    # Cannot deactivate self
    print("\n" + "=" * 60)
    print("TEST 10: Cannot deactivate self")
    print("=" * 60)

    success, error = service.deactivate_user(
        actor_id=super_admin.user_id,
        user_id=super_admin.user_id
    )
    assert success == False
    assert "yourself" in error.lower()

    # Cannot deactivate last super_admin
    print("\n" + "=" * 60)
    print("TEST 11: Cannot deactivate last super_admin")
    print("=" * 60)

    # First, reactivate the admin and demote to regular admin
    service.activate_user(super_admin.user_id, admin.user_id)
    service.update_user(super_admin.user_id, admin.user_id, role=UserRole.ADMIN)

    # Now try to deactivate the only super_admin using the regular admin
    # (In real system, regular admin can't do this - but testing the logic)
    success, error = service.deactivate_user(
        actor_id=admin.user_id,
        user_id=super_admin.user_id
    )
    assert success == False
    assert "last super_admin" in error.lower()

    # Reset password
    print("\n" + "=" * 60)
    print("TEST 12: Reset password")
    print("=" * 60)

    new_pass, error = service.reset_password(
        actor_id=super_admin.user_id,
        user_id=admin.user_id
    )
    assert new_pass is not None
    assert new_pass == DEFAULT_PASSWORD

    # Verify reset password works for login
    admin_user = db.get_user_by_id(admin.user_id)
    assert admin_user.must_change_password == True

    # Print final state
    print("\n" + "=" * 60)
    print("FINAL STATE")
    print("=" * 60)

    print("\nUsers:")
    for user in db.get_all_users():
        print(f"  - {user.email} ({user.role.value}) - Active: {user.is_active}")

    print(f"\nAudit Logs: {len(db.audit_logs)} entries")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)


if __name__ == '__main__':
    run_simulation()
