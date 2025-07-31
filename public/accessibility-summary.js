// Accessibility summary script to identify remaining issues
(function() {
  console.log('=== Accessibility Summary Report ===');
  console.log('Running on:', window.location.pathname);
  
  // Check all form elements
  const inputs = document.querySelectorAll('input:not([type="hidden"])');
  const selects = document.querySelectorAll('select');
  const textareas = document.querySelectorAll('textarea');
  const allFormElements = [...inputs, ...selects, ...textareas];
  
  // Filter out visually hidden elements
  const visibleElements = allFormElements.filter(el => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           el.offsetParent !== null;
  });
  
  // Check for issues
  const missingId = visibleElements.filter(el => !el.id || el.id.trim() === '');
  const missingName = visibleElements.filter(el => !el.name || el.name.trim() === '');
  const missingLabel = visibleElements.filter(el => {
    const hasLabel = el.labels && el.labels.length > 0;
    const hasAriaLabel = el.hasAttribute('aria-label') && el.getAttribute('aria-label').trim() !== '';
    const hasAriaLabelledBy = el.hasAttribute('aria-labelledby') && el.getAttribute('aria-labelledby').trim() !== '';
    return !hasLabel && !hasAriaLabel && !hasAriaLabelledBy;
  });
  
  console.log('\n=== STATISTICS ===');
  console.log('Total visible form elements:', visibleElements.length);
  console.log('Elements without ID:', missingId.length);
  console.log('Elements without name:', missingName.length);
  console.log('Elements without label:', missingLabel.length);
  
  // Group by parent component
  console.log('\n=== GROUPED BY PARENT CLASS ===');
  const groupByParent = {};
  
  [...missingId, ...missingName].forEach(el => {
    let parent = el.parentElement;
    let componentClass = 'unknown';
    
    // Try to find a meaningful parent class
    while (parent && parent !== document.body) {
      if (parent.className && parent.className.includes('modal') || 
          parent.className.includes('dialog') ||
          parent.className.includes('dropdown') ||
          parent.className.includes('tooltip') ||
          parent.className.includes('popover')) {
        componentClass = parent.className;
        break;
      }
      parent = parent.parentElement;
    }
    
    if (!groupByParent[componentClass]) {
      groupByParent[componentClass] = [];
    }
    groupByParent[componentClass].push({
      tag: el.tagName.toLowerCase(),
      type: el.type,
      id: el.id || 'NO_ID',
      name: el.name || 'NO_NAME',
      className: el.className
    });
  });
  
  Object.entries(groupByParent).forEach(([parent, elements]) => {
    console.log(`\nParent: ${parent}`);
    console.log(`Count: ${elements.length}`);
    elements.forEach(el => {
      console.log(`  - ${el.tag}[type="${el.type}"] id="${el.id}" name="${el.name}"`);
    });
  });
  
  // Check for dynamically added elements
  console.log('\n=== CHECKING FOR DYNAMIC ELEMENTS ===');
  setTimeout(() => {
    const newInputs = document.querySelectorAll('input:not([type="hidden"])');
    const newSelects = document.querySelectorAll('select');
    const newTextareas = document.querySelectorAll('textarea');
    const newTotal = newInputs.length + newSelects.length + newTextareas.length;
    
    console.log('Form elements after 2 seconds:', newTotal);
    if (newTotal > visibleElements.length) {
      console.log('New elements detected! Some form fields might be dynamically added.');
    }
  }, 2000);
  
  // Return counts for easy checking
  return {
    total: visibleElements.length,
    missingId: missingId.length,
    missingName: missingName.length,
    missingLabel: missingLabel.length
  };
})();