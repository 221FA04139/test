"""Run once on every deploy — creates tables and seeds initial data."""
import os
from dotenv import load_dotenv
load_dotenv()

from app import app
from database import db, seed_database

with app.app_context():
    db.create_all()
    seed_database()
    print("Database initialised and seeded.")
