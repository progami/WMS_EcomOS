/**
 * Test script to verify CSRF protection is working
 */

async function testCSRFProtection() {
  console.log('Testing CSRF Protection...\n')
  
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000'
  
  // Test 1: Try POST without CSRF token (should fail)
  console.log('Test 1: POST request without CSRF token')
  try {
    const response = await fetch(`${baseUrl}/api/skus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skuCode: 'TEST-SKU-001',
        description: 'Test SKU',
        unitsPerCarton: 10
      })
    })
    
    console.log(`Status: ${response.status}`)
    const data = await response.text()
    console.log(`Response: ${data}`)
    
    if (response.status === 403) {
      console.log('✅ CSRF protection working - request blocked as expected\n')
    } else {
      console.log('❌ CSRF protection not working - request should have been blocked\n')
    }
  } catch (error) {
    console.error('Error:', error)
  }
  
  // Test 2: Get CSRF token
  console.log('Test 2: Get CSRF token')
  try {
    const response = await fetch(`${baseUrl}/api/auth/csrf`, {
      credentials: 'include'
    })
    
    console.log(`Status: ${response.status}`)
    
    // Extract CSRF token from cookies
    const setCookie = response.headers.get('set-cookie')
    const csrfToken = setCookie?.match(/csrf-token=([^;]+)/)?.[1]
    
    if (csrfToken) {
      console.log(`✅ CSRF token received: ${csrfToken.substring(0, 10)}...\n`)
      
      // Test 3: Try POST with CSRF token (should work)
      console.log('Test 3: POST request with CSRF token')
      const postResponse = await fetch(`${baseUrl}/api/skus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          'Cookie': `csrf-token=${csrfToken}`
        },
        body: JSON.stringify({
          skuCode: 'TEST-SKU-001',
          description: 'Test SKU',
          unitsPerCarton: 10
        })
      })
      
      console.log(`Status: ${postResponse.status}`)
      
      if (postResponse.status !== 403) {
        console.log('✅ CSRF token accepted - request processed\n')
      } else {
        console.log('❌ CSRF token not working - request was still blocked\n')
      }
    } else {
      console.log('❌ No CSRF token received\n')
    }
  } catch (error) {
    console.error('Error:', error)
  }
  
  // Test 4: Verify GET requests don't need CSRF
  console.log('Test 4: GET request (should not need CSRF token)')
  try {
    const response = await fetch(`${baseUrl}/api/skus`)
    console.log(`Status: ${response.status}`)
    
    if (response.status === 200 || response.status === 401) {
      console.log('✅ GET requests work without CSRF token\n')
    } else if (response.status === 403) {
      console.log('❌ GET requests incorrectly require CSRF token\n')
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

// Run the tests
testCSRFProtection().catch(console.error)