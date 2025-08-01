module.exports = {
  rules: {
    // Prevent usage of potentially dangerous SQL methods
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='$queryRawUnsafe']",
        message: 'Use $queryRaw with template literals for parameterized queries instead of $queryRawUnsafe'
      },
      {
        selector: "CallExpression[callee.property.name='$executeRawUnsafe']",
        message: 'Use $executeRaw with template literals for parameterized queries instead of $executeRawUnsafe'
      }
    ],
    // Prevent string concatenation in SQL-like contexts
    'no-restricted-properties': [
      'error',
      {
        object: 'prisma',
        property: '$queryRawUnsafe',
        message: 'Use $queryRaw with template literals for safe parameterized queries'
      },
      {
        object: 'prisma', 
        property: '$executeRawUnsafe',
        message: 'Use $executeRaw with template literals for safe parameterized queries'
      }
    ]
  }
}