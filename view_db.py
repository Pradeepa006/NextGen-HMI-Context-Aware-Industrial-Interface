import sqlite3

conn = sqlite3.connect('backend/nextgen_hmi.db')
cursor = conn.cursor()

# List tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cursor.fetchall()]
print("Tables:", tables)

# Show first 5 rows of each table
for table in tables:
    print(f"\n--- {table} ---")
    cursor.execute(f"SELECT * FROM [{table}] LIMIT 5")
    cols = [d[0] for d in cursor.description]
    print("Columns:", cols)
    for row in cursor.fetchall():
        print(row)

conn.close()
