
// Priority color mapping
function getPriorityColor(priority, isCompleted) {
  if (isCompleted) return '#3b82f6'; // Blue for completed
  const colors = {
    low: '#22c55e',      // Green
    medium: '#eab308',   // Yellow
    high: '#ef4444'      // Red
  };
  return colors[priority] || colors.medium;
}

function getPriorityTextColor(priority, isCompleted) {
  if (isCompleted) return '#ffffff'; // White text for blue background
  const colors = {
    low: '#ffffff',
    medium: '#000000',
    high: '#ffffff'
  };
  return colors[priority] || colors.medium;
}

function getPriorityBorderColor(priority, isCompleted) {
  if (isCompleted) return '#1e40af'; // Darker blue for border
  const colors = {
    low: '#16a34a',      // Dark green
    medium: '#ca8a04',   // Dark yellow
    high: '#dc2626'      // Dark red
  };
  return colors[priority] || colors.medium;
}

