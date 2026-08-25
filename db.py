import psycopg2

def get_connection():
    """
    Opens a new connection to the local `prototype` database.

    No host/user/password are passed on purpose: this connects exactly
    the same way `psql -d prototype` does on your machine (local Unix
    socket, trust auth using your macOS username). If `psql -d prototype`
    works for you in the terminal, this will work too, with no extra
    configuration.
    """
    return psycopg2.connect(dbname="prototype")
