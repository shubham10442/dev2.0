"""Initial ANN Schema

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-08-29 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # users
    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('email', sa.String(length=255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(length=255), nullable=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False, default='donor'),
        sa.Column('photo_url', sa.Text(), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('verified', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # user_profiles
    op.create_table(
        'user_profiles',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('user_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('kitchen_type', sa.String(length=255), nullable=True),
        sa.Column('shelter_type', sa.String(length=255), nullable=True),
        sa.Column('license_id', sa.String(length=100), nullable=True),
        sa.Column('reg_id', sa.String(length=100), nullable=True),
        sa.Column('section_80g_status', sa.String(length=100), nullable=True),
        sa.Column('operating_hours', sa.String(length=100), nullable=True),
        sa.Column('capacity', sa.String(length=100), nullable=True),
        sa.Column('fleet', sa.String(length=100), nullable=True),
        sa.Column('meals_diverted', sa.Integer(), default=0),
        sa.Column('meals_served', sa.Integer(), default=0),
        sa.Column('carbon_offset_kg', sa.Float(), default=0.0),
        sa.Column('lat', sa.Float(), default=28.6139),
        sa.Column('lng', sa.Float(), default=77.2090),
        sa.Column('gps_address', sa.Text(), nullable=True),
    )

    # donations
    op.create_table(
        'donations',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('numeric_id', sa.Integer(), nullable=False, unique=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('category', sa.String(length=100), default='Cooked Meals'),
        sa.Column('food_type', sa.String(length=50), default='veg'),
        sa.Column('servings', sa.Integer(), default=25),
        sa.Column('donor_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('donor_name', sa.String(length=255), nullable=False),
        sa.Column('donor_email', sa.String(length=255), nullable=False),
        sa.Column('lat', sa.Float(), default=28.6139),
        sa.Column('lng', sa.Float(), default=77.2090),
        sa.Column('gps_address', sa.Text(), nullable=True),
        sa.Column('image_url', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(length=20), default='🍲'),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('expiry_string', sa.String(length=50), default='2h 30m'),
        sa.Column('tag', sa.String(length=50), default='Just Listed'),
        sa.Column('tag_color', sa.String(length=30), default='emerald'),
        sa.Column('status', sa.String(length=50), default='Awaiting NGO Claim'),
        sa.Column('claimed', sa.Boolean(), default=False),
        sa.Column('claimed_by_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('claimed_by_name', sa.String(length=255), nullable=True),
        sa.Column('claimed_by_email', sa.String(length=255), nullable=True),
        sa.Column('claimed_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('extra_info', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )
    op.create_index(op.f('ix_donations_numeric_id'), 'donations', ['numeric_id'], unique=True)

    # claims
    op.create_table(
        'claims',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('donation_id', sa.String(length=36), sa.ForeignKey('donations.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('ngo_id', sa.String(length=36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('ngo_name', sa.String(length=255), nullable=False),
        sa.Column('ngo_email', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), default='Driver Dispatched'),
        sa.Column('claim_time', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('delivery_notes', sa.Text(), nullable=True),
    )

    # activity_logs & otp_verifications
    op.create_table(
        'activity_logs',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('meta', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'otp_verifications',
        sa.Column('email', sa.String(length=255), primary_key=True),
        sa.Column('otp_code', sa.String(length=10), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('attempts', sa.String(length=10), default='0'),
    )

    # badges
    op.create_table(
        'badges',
        sa.Column('id', sa.String(length=36), primary_key=True),
        sa.Column('code', sa.String(length=50), unique=True, nullable=False),
        sa.Column('title', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=False),
        sa.Column('icon', sa.String(length=50), default='award'),
        sa.Column('category', sa.String(length=50), default='sustainability'),
        sa.Column('threshold_value', sa.Float(), default=100.0),
    )

def downgrade():
    op.drop_table('badges')
    op.drop_table('otp_verifications')
    op.drop_table('activity_logs')
    op.drop_table('claims')
    op.drop_table('donations')
    op.drop_table('user_profiles')
    op.drop_table('users')