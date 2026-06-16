import sqlite3

def check_db():
    try:
        conn = sqlite3.connect('radar.db')
        cursor = conn.cursor()
        
        for table in ['users', 'opportunities', 'user_opportunities']:
            cursor.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            print(f"Table '{table}': {len(rows)} rows found.")
            if rows:
                print(f"Sample row: {rows[0]}")
            print("-" * 40)
            
        conn.close()
    except Exception as e:
        print(f"Error checking DB: {e}")

if __name__ == "__main__":
    check_db()
