@'
SELECT
    column_name,
    data_type,
    udt_name,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'User'
ORDER BY ordinal_position;
'@ | Set-Content -Path .\check-user-columns.sql