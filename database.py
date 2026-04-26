from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

ACCOUNTS = [
    "Nayeem UCO Savings",
    "Nayeem UCO Current",
    "Nayeem UCO Current 2",
    "Nayeem HDFC Savings",
    "Subhan Khan UCO Current",
    "Subhan Khan 540 Loan",
    "Subhan Khan SBI Current",
    "Subhan Khan UCO Current 2",
    "Subhan Khan Canara",
    "Mahaboob Bi",
    "Mubeena",
    "Other",
]

CATEGORIES = {
    "Hostel": [
        "Rent Income", "Maintenance", "Salaries", "Electricity",
        "Water", "Internet", "Repairs", "Supplies", "Other-Hostel",
    ],
    "2nd Building Construction": [
        "Foundation", "Structure", "Plaster", "Tiling", "Painting",
        "Electrical", "Plumbing", "Labour", "Materials", "Other-2nd Bldg",
    ],
    "Lara Building": [
        "Rent Income", "Maintenance", "Repairs", "Utilities", "Other-Lara",
    ],
    "Indoor Stadium": [
        "Construction", "Equipment", "Salaries", "Maintenance", "Revenue", "Other-Stadium",
    ],
    "Nayeem-Personal": [
        "Food", "Transport", "Medical", "Shopping", "Education", "Entertainment", "Other-Personal",
    ],
    "Family": [
        "Household", "Education", "Medical", "Transfers", "Gifts", "Other-Family",
    ],
    "Other": [
        "Miscellaneous", "Bank Charges", "Loan EMI", "Investment", "Other",
    ],
}


class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="viewer")
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
        }


class Transaction(db.Model):
    __tablename__ = "transactions"
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    type = db.Column(db.String(20), nullable=False)  # Income | Expense | Transfer
    account = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    subcat = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    amount = db.Column(db.Numeric(14, 2), nullable=False)
    ref = db.Column(db.String(100), nullable=True)
    to_account = db.Column(db.String(100), nullable=True)  # Transfer destination
    month = db.Column(db.String(7), nullable=False)  # YYYY-MM
    entered_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    is_deleted = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat(),
            "type": self.type,
            "account": self.account,
            "category": self.category,
            "subcat": self.subcat or "",
            "description": self.description or "",
            "amount": float(self.amount),
            "ref": self.ref or "",
            "to_account": self.to_account or "",
            "month": self.month,
            "created_at": self.created_at.isoformat(),
        }


class OpeningBalance(db.Model):
    __tablename__ = "opening_balances"
    id = db.Column(db.Integer, primary_key=True)
    account = db.Column(db.String(100), unique=True, nullable=False)
    balance = db.Column(db.Numeric(14, 2), default=0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)


class Category(db.Model):
    __tablename__ = "categories"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class AuditLog(db.Model):
    __tablename__ = "audit_log"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(50), nullable=False)
    table_name = db.Column(db.String(50), nullable=False)
    record_id = db.Column(db.Integer, nullable=True)
    old_value = db.Column(db.Text, nullable=True)
    detail = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


def seed_database():
    """Seed initial data. Safe to run multiple times — checks before inserting."""
    # Admin user
    if not User.query.filter_by(username="nayeem").first():
        user = User(username="nayeem", email="pathannayeem2@gmail.com", role="admin", is_active=True)
        user.set_password("finance2025")
        db.session.add(user)
        db.session.flush()

    # Opening balances for every account
    for account in ACCOUNTS:
        if not OpeningBalance.query.filter_by(account=account).first():
            db.session.add(OpeningBalance(account=account, balance=0))

    # Categories + sub-categories
    for cat_name, subcats in CATEGORIES.items():
        cat = Category.query.filter_by(name=cat_name, parent_id=None).first()
        if not cat:
            cat = Category(name=cat_name, parent_id=None, sort_order=list(CATEGORIES.keys()).index(cat_name))
            db.session.add(cat)
            db.session.flush()
        for i, sub_name in enumerate(subcats):
            if not Category.query.filter_by(name=sub_name, parent_id=cat.id).first():
                db.session.add(Category(name=sub_name, parent_id=cat.id, sort_order=i))

    db.session.commit()
