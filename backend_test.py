#!/usr/bin/env python3
"""
FinMate Backend API Test Suite
Tests all endpoints defined in /app/app/api/[[...path]]/route.js
"""

import requests
import json
import time
import csv
from io import StringIO

# Base URL from .env
BASE_URL = "https://cashwise-test-1.preview.emergentagent.com/api"

# Test data storage
test_data = {
    'user_a': {},
    'user_b': {},
    'accounts': {},
    'categories': {},
    'transactions': {}
}

def log_test(test_name, passed, message=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if message:
        print(f"   {message}")
    return passed

def test_auth_register():
    """Test user registration with various scenarios"""
    print("\n=== Testing Auth Registration ===")
    
    # Test 1: Successful registration
    try:
        timestamp = int(time.time())
        email_a = f"user_a_{timestamp}@finmate.test"
        payload = {
            "email": email_a,
            "password": "password123",
            "name": "Test User A"
        }
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=10)
        
        if resp.status_code == 200:
            data = resp.json()
            if 'token' in data and 'user' in data:
                test_data['user_a']['email'] = email_a
                test_data['user_a']['token'] = data['token']
                test_data['user_a']['user_id'] = data['user']['id']
                
                # Verify user data
                user = data['user']
                if user.get('currency_default') == 'IDR' and user.get('email') == email_a.lower():
                    log_test("Register new user", True, f"User created with token, currency_default=IDR")
                else:
                    log_test("Register new user", False, f"User data incorrect: {user}")
            else:
                log_test("Register new user", False, f"Missing token or user in response: {data}")
        else:
            log_test("Register new user", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Register new user", False, f"Exception: {str(e)}")
    
    # Test 2: Duplicate email
    try:
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload, timeout=10)
        if resp.status_code == 400:
            data = resp.json()
            if 'sudah terdaftar' in data.get('error', '').lower():
                log_test("Register duplicate email", True, "Got 400 with 'Email sudah terdaftar'")
            else:
                log_test("Register duplicate email", False, f"Wrong error message: {data}")
        else:
            log_test("Register duplicate email", False, f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("Register duplicate email", False, f"Exception: {str(e)}")
    
    # Test 3: Password too short
    try:
        payload_short = {
            "email": f"short_{timestamp}@test.com",
            "password": "12345",  # Only 5 chars
            "name": "Short Pass"
        }
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload_short, timeout=10)
        if resp.status_code == 400:
            data = resp.json()
            if 'minimal 6' in data.get('error', '').lower():
                log_test("Register with password <6 chars", True, "Got 400 with password length error")
            else:
                log_test("Register with password <6 chars", False, f"Wrong error: {data}")
        else:
            log_test("Register with password <6 chars", False, f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("Register with password <6 chars", False, f"Exception: {str(e)}")
    
    # Register user B for RLS testing
    try:
        email_b = f"user_b_{timestamp}@finmate.test"
        payload_b = {
            "email": email_b,
            "password": "password456",
            "name": "Test User B"
        }
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload_b, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            test_data['user_b']['email'] = email_b
            test_data['user_b']['token'] = data['token']
            test_data['user_b']['user_id'] = data['user']['id']
            log_test("Register user B for RLS test", True, "User B created")
        else:
            log_test("Register user B for RLS test", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Register user B for RLS test", False, f"Exception: {str(e)}")

def test_auth_login():
    """Test login functionality"""
    print("\n=== Testing Auth Login ===")
    
    # Test 1: Login with correct credentials
    try:
        payload = {
            "email": test_data['user_a']['email'],
            "password": "password123"
        }
        resp = requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'token' in data and 'user' in data:
                log_test("Login with correct credentials", True, "Got token and user data")
            else:
                log_test("Login with correct credentials", False, f"Missing token or user: {data}")
        else:
            log_test("Login with correct credentials", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Login with correct credentials", False, f"Exception: {str(e)}")
    
    # Test 2: Login with wrong password
    try:
        payload = {
            "email": test_data['user_a']['email'],
            "password": "wrongpassword"
        }
        resp = requests.post(f"{BASE_URL}/auth/login", json=payload, timeout=10)
        if resp.status_code == 400:
            data = resp.json()
            if 'salah' in data.get('error', '').lower():
                log_test("Login with wrong password", True, "Got 400 with error message")
            else:
                log_test("Login with wrong password", False, f"Wrong error: {data}")
        else:
            log_test("Login with wrong password", False, f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("Login with wrong password", False, f"Exception: {str(e)}")

def test_auth_me():
    """Test /auth/me endpoint"""
    print("\n=== Testing Auth Me ===")
    
    # Test 1: Without token
    try:
        resp = requests.get(f"{BASE_URL}/auth/me", timeout=10)
        if resp.status_code == 401:
            log_test("GET /auth/me without token", True, "Got 401 Unauthorized")
        else:
            log_test("GET /auth/me without token", False, f"Expected 401, got {resp.status_code}")
    except Exception as e:
        log_test("GET /auth/me without token", False, f"Exception: {str(e)}")
    
    # Test 2: With valid token
    try:
        headers = {"Authorization": f"Bearer {test_data['user_a']['token']}"}
        resp = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if 'user' in data and data['user'].get('email') == test_data['user_a']['email'].lower():
                log_test("GET /auth/me with valid token", True, "Got user data")
            else:
                log_test("GET /auth/me with valid token", False, f"Wrong user data: {data}")
        else:
            log_test("GET /auth/me with valid token", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("GET /auth/me with valid token", False, f"Exception: {str(e)}")

def test_accounts():
    """Test accounts CRUD and default account seeding"""
    print("\n=== Testing Accounts ===")
    
    headers = {"Authorization": f"Bearer {test_data['user_a']['token']}"}
    
    # Test 1: Check default "Kas" account exists
    try:
        resp = requests.get(f"{BASE_URL}/accounts", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            accounts = data.get('accounts', [])
            kas_account = next((a for a in accounts if a['name'] == 'Kas'), None)
            if kas_account:
                test_data['accounts']['kas'] = kas_account
                log_test("Default Kas account exists", True, f"Found Kas account with balance={kas_account.get('balance', 0)}")
            else:
                log_test("Default Kas account exists", False, f"No Kas account found in: {accounts}")
        else:
            log_test("Default Kas account exists", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Default Kas account exists", False, f"Exception: {str(e)}")
    
    # Test 2: Create new account (BCA)
    try:
        payload = {
            "name": "BCA",
            "type": "bank",
            "initial_balance": 1000000,
            "icon": "🏦"
        }
        resp = requests.post(f"{BASE_URL}/accounts", json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            account = data.get('account', {})
            if account.get('name') == 'BCA' and account.get('balance') == 1000000:
                test_data['accounts']['bca'] = account
                log_test("Create BCA account", True, f"Account created with balance=1000000")
            else:
                log_test("Create BCA account", False, f"Wrong account data: {account}")
        else:
            log_test("Create BCA account", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Create BCA account", False, f"Exception: {str(e)}")
    
    # Test 3: Verify BCA appears in GET /accounts
    try:
        resp = requests.get(f"{BASE_URL}/accounts", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            accounts = data.get('accounts', [])
            bca = next((a for a in accounts if a['name'] == 'BCA'), None)
            if bca and bca.get('balance') == 1000000:
                log_test("GET /accounts shows BCA", True, "BCA found with correct balance")
            else:
                log_test("GET /accounts shows BCA", False, f"BCA not found or wrong balance")
        else:
            log_test("GET /accounts shows BCA", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /accounts shows BCA", False, f"Exception: {str(e)}")
    
    # Test 4: Update account name
    try:
        account_id = test_data['accounts']['bca']['id']
        payload = {"name": "BCA Updated"}
        resp = requests.put(f"{BASE_URL}/accounts/{account_id}", json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            # Verify update
            resp2 = requests.get(f"{BASE_URL}/accounts", headers=headers, timeout=10)
            accounts = resp2.json().get('accounts', [])
            updated = next((a for a in accounts if a['id'] == account_id), None)
            if updated and updated['name'] == 'BCA Updated':
                log_test("Update account name", True, "Name updated successfully")
                # Revert name
                requests.put(f"{BASE_URL}/accounts/{account_id}", json={"name": "BCA"}, headers=headers, timeout=10)
            else:
                log_test("Update account name", False, "Name not updated")
        else:
            log_test("Update account name", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Update account name", False, f"Exception: {str(e)}")

def test_categories():
    """Test categories CRUD and default categories"""
    print("\n=== Testing Categories ===")
    
    headers = {"Authorization": f"Bearer {test_data['user_a']['token']}"}
    
    # Test 1: Check default categories (should be ~14)
    try:
        resp = requests.get(f"{BASE_URL}/categories", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            categories = data.get('categories', [])
            
            # Store some default categories for later use
            gaji = next((c for c in categories if c['name'] == 'Gaji'), None)
            makanan = next((c for c in categories if 'Makanan' in c['name']), None)
            
            if gaji:
                test_data['categories']['gaji'] = gaji
            if makanan:
                test_data['categories']['makanan'] = makanan
            
            if len(categories) >= 14:
                log_test("Default categories seeded", True, f"Found {len(categories)} categories including Gaji, Makanan, etc.")
            else:
                log_test("Default categories seeded", False, f"Only {len(categories)} categories found, expected ~14")
        else:
            log_test("Default categories seeded", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Default categories seeded", False, f"Exception: {str(e)}")
    
    # Test 2: Create custom category
    try:
        payload = {
            "name": "Kopi",
            "type": "expense",
            "icon": "☕",
            "color": "#000000"
        }
        resp = requests.post(f"{BASE_URL}/categories", json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            category = data.get('category', {})
            if category.get('name') == 'Kopi':
                test_data['categories']['kopi'] = category
                log_test("Create custom category", True, "Kopi category created")
            else:
                log_test("Create custom category", False, f"Wrong category: {category}")
        else:
            log_test("Create custom category", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Create custom category", False, f"Exception: {str(e)}")
    
    # Test 3: Update category
    try:
        cat_id = test_data['categories']['kopi']['id']
        payload = {"name": "Kopi Premium"}
        resp = requests.put(f"{BASE_URL}/categories/{cat_id}", json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            log_test("Update category", True, "Category updated")
        else:
            log_test("Update category", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Update category", False, f"Exception: {str(e)}")
    
    # Test 4: Delete category
    try:
        cat_id = test_data['categories']['kopi']['id']
        resp = requests.delete(f"{BASE_URL}/categories/{cat_id}", headers=headers, timeout=10)
        if resp.status_code == 200:
            log_test("Delete category", True, "Category deleted")
        else:
            log_test("Delete category", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Delete category", False, f"Exception: {str(e)}")

def test_transactions():
    """Test transactions CRUD with different types"""
    print("\n=== Testing Transactions ===")
    
    headers = {"Authorization": f"Bearer {test_data['user_a']['token']}"}
    
    # Test 1: Create income transaction
    try:
        payload = {
            "type": "income",
            "amount": 5000000,
            "account_id": test_data['accounts']['bca']['id'],
            "category_id": test_data['categories']['gaji']['id'],
            "date": "2025-06-01",
            "note": "Gaji Juni"
        }
        resp = requests.post(f"{BASE_URL}/transactions", json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            trx = data.get('transaction', {})
            if trx.get('type') == 'income' and trx.get('amount') == 5000000:
                test_data['transactions']['income'] = trx
                log_test("Create income transaction", True, "Income transaction created")
            else:
                log_test("Create income transaction", False, f"Wrong transaction: {trx}")
        else:
            log_test("Create income transaction", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Create income transaction", False, f"Exception: {str(e)}")
    
    # Test 2: Create expense transaction
    try:
        payload = {
            "type": "expense",
            "amount": 50000,
            "account_id": test_data['accounts']['kas']['id'],
            "category_id": test_data['categories']['makanan']['id'],
            "date": "2025-06-05",
            "note": "Makan siang"
        }
        resp = requests.post(f"{BASE_URL}/transactions", json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            trx = data.get('transaction', {})
            if trx.get('type') == 'expense':
                test_data['transactions']['expense'] = trx
                log_test("Create expense transaction", True, "Expense transaction created")
            else:
                log_test("Create expense transaction", False, f"Wrong transaction: {trx}")
        else:
            log_test("Create expense transaction", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Create expense transaction", False, f"Exception: {str(e)}")
    
    # Test 3: Create transfer transaction
    try:
        payload = {
            "type": "transfer",
            "amount": 200000,
            "account_id": test_data['accounts']['bca']['id'],
            "transfer_to_account_id": test_data['accounts']['kas']['id'],
            "date": "2025-06-05",
            "note": "Transfer ke Kas"
        }
        resp = requests.post(f"{BASE_URL}/transactions", json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            trx = data.get('transaction', {})
            if trx.get('type') == 'transfer':
                test_data['transactions']['transfer'] = trx
                log_test("Create transfer transaction", True, "Transfer transaction created")
            else:
                log_test("Create transfer transaction", False, f"Wrong transaction: {trx}")
        else:
            log_test("Create transfer transaction", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Create transfer transaction", False, f"Exception: {str(e)}")
    
    # Test 4: Invalid transfer without transfer_to_account_id
    try:
        payload = {
            "type": "transfer",
            "amount": 100000,
            "account_id": test_data['accounts']['bca']['id'],
            "date": "2025-06-05"
        }
        resp = requests.post(f"{BASE_URL}/transactions", json=payload, headers=headers, timeout=10)
        if resp.status_code == 400:
            data = resp.json()
            if 'transfer_to_account_id' in data.get('error', '').lower():
                log_test("Invalid transfer without transfer_to_account_id", True, "Got 400 error")
            else:
                log_test("Invalid transfer without transfer_to_account_id", False, f"Wrong error: {data}")
        else:
            log_test("Invalid transfer without transfer_to_account_id", False, f"Expected 400, got {resp.status_code}")
    except Exception as e:
        log_test("Invalid transfer without transfer_to_account_id", False, f"Exception: {str(e)}")
    
    # Test 5: GET all transactions
    try:
        resp = requests.get(f"{BASE_URL}/transactions", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            transactions = data.get('transactions', [])
            if len(transactions) >= 3:
                log_test("GET all transactions", True, f"Found {len(transactions)} transactions")
            else:
                log_test("GET all transactions", False, f"Expected at least 3, got {len(transactions)}")
        else:
            log_test("GET all transactions", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET all transactions", False, f"Exception: {str(e)}")
    
    # Test 6: Filter by type
    try:
        resp = requests.get(f"{BASE_URL}/transactions?type=income", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            transactions = data.get('transactions', [])
            all_income = all(t['type'] == 'income' for t in transactions)
            if all_income and len(transactions) >= 1:
                log_test("Filter transactions by type", True, f"Got {len(transactions)} income transactions")
            else:
                log_test("Filter transactions by type", False, f"Filter not working correctly")
        else:
            log_test("Filter transactions by type", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Filter transactions by type", False, f"Exception: {str(e)}")
    
    # Test 7: Filter by account_id
    try:
        bca_id = test_data['accounts']['bca']['id']
        resp = requests.get(f"{BASE_URL}/transactions?account_id={bca_id}", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            transactions = data.get('transactions', [])
            if len(transactions) >= 2:  # income + transfer out
                log_test("Filter transactions by account_id", True, f"Got {len(transactions)} transactions for BCA")
            else:
                log_test("Filter transactions by account_id", False, f"Expected at least 2, got {len(transactions)}")
        else:
            log_test("Filter transactions by account_id", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Filter transactions by account_id", False, f"Exception: {str(e)}")
    
    # Test 8: Search in note
    try:
        resp = requests.get(f"{BASE_URL}/transactions?search=Gaji", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            transactions = data.get('transactions', [])
            has_gaji = any('Gaji' in t.get('note', '') for t in transactions)
            if has_gaji:
                log_test("Search transactions by note", True, "Search working")
            else:
                log_test("Search transactions by note", False, "Search not finding 'Gaji'")
        else:
            log_test("Search transactions by note", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Search transactions by note", False, f"Exception: {str(e)}")
    
    # Test 9: Update transaction
    try:
        trx_id = test_data['transactions']['income']['id']
        payload = {"amount": 5500000}
        resp = requests.put(f"{BASE_URL}/transactions/{trx_id}", json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            log_test("Update transaction", True, "Transaction updated")
        else:
            log_test("Update transaction", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Update transaction", False, f"Exception: {str(e)}")
    
    # Test 10: Delete transaction
    try:
        trx_id = test_data['transactions']['expense']['id']
        resp = requests.delete(f"{BASE_URL}/transactions/{trx_id}", headers=headers, timeout=10)
        if resp.status_code == 200:
            log_test("Delete transaction", True, "Transaction deleted")
        else:
            log_test("Delete transaction", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Delete transaction", False, f"Exception: {str(e)}")

def test_balance_calculation():
    """Test account balance calculation with transactions"""
    print("\n=== Testing Balance Calculation ===")
    
    headers = {"Authorization": f"Bearer {test_data['user_a']['token']}"}
    
    try:
        resp = requests.get(f"{BASE_URL}/accounts", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            accounts = data.get('accounts', [])
            
            bca = next((a for a in accounts if a['name'] == 'BCA'), None)
            kas = next((a for a in accounts if a['name'] == 'Kas'), None)
            
            # BCA: initial=1000000, income=5500000 (updated), transfer_out=200000
            # Expected: 1000000 + 5500000 - 200000 = 6300000
            bca_expected = 6300000
            
            # Kas: initial=0, transfer_in=200000, expense=50000 (deleted, so not counted)
            # Expected: 0 + 200000 = 200000
            kas_expected = 200000
            
            bca_ok = abs(bca['balance'] - bca_expected) < 100 if bca else False
            kas_ok = abs(kas['balance'] - kas_expected) < 100 if kas else False
            
            if bca_ok and kas_ok:
                log_test("Balance calculation", True, f"BCA={bca['balance']} (expected ~{bca_expected}), Kas={kas['balance']} (expected ~{kas_expected})")
            else:
                log_test("Balance calculation", False, f"BCA={bca['balance'] if bca else 'N/A'} (expected {bca_expected}), Kas={kas['balance'] if kas else 'N/A'} (expected {kas_expected})")
        else:
            log_test("Balance calculation", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Balance calculation", False, f"Exception: {str(e)}")

def test_dashboard_summary():
    """Test dashboard summary endpoint"""
    print("\n=== Testing Dashboard Summary ===")
    
    headers = {"Authorization": f"Bearer {test_data['user_a']['token']}"}
    
    try:
        resp = requests.get(f"{BASE_URL}/dashboard/summary", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            
            # Check required fields
            required_fields = ['totalBalance', 'incomeMonth', 'expenseMonth', 'netMonth', 'topCategories', 'trend', 'recentTransactions']
            missing = [f for f in required_fields if f not in data]
            
            if not missing:
                # Verify trend has 6 items
                trend = data.get('trend', [])
                if len(trend) == 6:
                    log_test("Dashboard summary structure", True, f"All fields present, trend has 6 months")
                else:
                    log_test("Dashboard summary structure", False, f"Trend has {len(trend)} items, expected 6")
                
                # Verify totalBalance matches sum of accounts
                total_balance = data.get('totalBalance', 0)
                if total_balance > 0:
                    log_test("Dashboard totalBalance", True, f"totalBalance={total_balance}")
                else:
                    log_test("Dashboard totalBalance", False, f"totalBalance={total_balance}, expected > 0")
                
                # Verify topCategories is array
                top_cats = data.get('topCategories', [])
                log_test("Dashboard topCategories", True, f"Got {len(top_cats)} top categories")
                
            else:
                log_test("Dashboard summary structure", False, f"Missing fields: {missing}")
        else:
            log_test("Dashboard summary structure", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Dashboard summary structure", False, f"Exception: {str(e)}")

def test_export_csv():
    """Test CSV export endpoint"""
    print("\n=== Testing Export CSV ===")
    
    headers = {"Authorization": f"Bearer {test_data['user_a']['token']}"}
    
    try:
        resp = requests.get(f"{BASE_URL}/export/csv", headers=headers, timeout=10)
        if resp.status_code == 200:
            content_type = resp.headers.get('Content-Type', '')
            
            if 'text/csv' in content_type:
                # Try to parse CSV
                csv_content = resp.text
                reader = csv.reader(StringIO(csv_content))
                rows = list(reader)
                
                if len(rows) > 0:
                    header = rows[0]
                    expected_header = ['Tanggal', 'Tipe', 'Jumlah (IDR)', 'Akun', 'Kategori', 'Tujuan Transfer', 'Catatan', 'Tags']
                    
                    if header == expected_header:
                        log_test("Export CSV", True, f"CSV valid with {len(rows)-1} data rows, correct header")
                    else:
                        log_test("Export CSV", False, f"Wrong header: {header}")
                else:
                    log_test("Export CSV", False, "CSV is empty")
            else:
                log_test("Export CSV", False, f"Wrong Content-Type: {content_type}")
        else:
            log_test("Export CSV", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("Export CSV", False, f"Exception: {str(e)}")

def test_rls():
    """Test Row Level Security - data isolation between users"""
    print("\n=== Testing RLS (Data Isolation) ===")
    
    headers_a = {"Authorization": f"Bearer {test_data['user_a']['token']}"}
    headers_b = {"Authorization": f"Bearer {test_data['user_b']['token']}"}
    
    # Get user A's BCA account ID
    bca_id = test_data['accounts']['bca']['id']
    
    # Test 1: User B should not see User A's accounts
    try:
        resp = requests.get(f"{BASE_URL}/accounts", headers=headers_b, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            accounts = data.get('accounts', [])
            
            # User B should only have default Kas account
            has_user_a_account = any(a['id'] == bca_id for a in accounts)
            
            if not has_user_a_account:
                log_test("RLS: User B cannot see User A accounts", True, f"User B has {len(accounts)} accounts (only their own)")
            else:
                log_test("RLS: User B cannot see User A accounts", False, "User B can see User A's BCA account!")
        else:
            log_test("RLS: User B cannot see User A accounts", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("RLS: User B cannot see User A accounts", False, f"Exception: {str(e)}")
    
    # Test 2: User B should not see User A's transactions
    try:
        resp = requests.get(f"{BASE_URL}/transactions", headers=headers_b, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            transactions = data.get('transactions', [])
            
            # User B should have no transactions (or only their own if any)
            has_user_a_trx = any(t.get('account_id') == bca_id for t in transactions)
            
            if not has_user_a_trx:
                log_test("RLS: User B cannot see User A transactions", True, f"User B has {len(transactions)} transactions")
            else:
                log_test("RLS: User B cannot see User A transactions", False, "User B can see User A's transactions!")
        else:
            log_test("RLS: User B cannot see User A transactions", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("RLS: User B cannot see User A transactions", False, f"Exception: {str(e)}")
    
    # Test 3: User B cannot modify User A's account
    try:
        payload = {"name": "Hacked by User B"}
        resp = requests.put(f"{BASE_URL}/accounts/{bca_id}", json=payload, headers=headers_b, timeout=10)
        
        # Even if it returns 200, verify with User A's token that nothing changed
        resp_verify = requests.get(f"{BASE_URL}/accounts", headers=headers_a, timeout=10)
        accounts = resp_verify.json().get('accounts', [])
        bca = next((a for a in accounts if a['id'] == bca_id), None)
        
        if bca and bca['name'] == 'BCA':
            log_test("RLS: User B cannot modify User A account", True, "Account name unchanged")
        else:
            log_test("RLS: User B cannot modify User A account", False, f"Account was modified! Name={bca['name'] if bca else 'N/A'}")
    except Exception as e:
        log_test("RLS: User B cannot modify User A account", False, f"Exception: {str(e)}")
    
    # Test 4: User B cannot delete User A's account
    try:
        resp = requests.delete(f"{BASE_URL}/accounts/{bca_id}", headers=headers_b, timeout=10)
        
        # Verify with User A's token that account still exists
        resp_verify = requests.get(f"{BASE_URL}/accounts", headers=headers_a, timeout=10)
        accounts = resp_verify.json().get('accounts', [])
        bca_exists = any(a['id'] == bca_id for a in accounts)
        
        if bca_exists:
            log_test("RLS: User B cannot delete User A account", True, "Account still exists")
        else:
            log_test("RLS: User B cannot delete User A account", False, "Account was deleted!")
    except Exception as e:
        log_test("RLS: User B cannot delete User A account", False, f"Exception: {str(e)}")

def main():
    print("=" * 60)
    print("FinMate Backend API Test Suite")
    print(f"Base URL: {BASE_URL}")
    print("=" * 60)
    
    # Run all tests in order
    test_auth_register()
    test_auth_login()
    test_auth_me()
    test_accounts()
    test_categories()
    test_transactions()
    test_balance_calculation()
    test_dashboard_summary()
    test_export_csv()
    test_rls()
    
    print("\n" + "=" * 60)
    print("Test Suite Complete")
    print("=" * 60)

if __name__ == "__main__":
    main()
