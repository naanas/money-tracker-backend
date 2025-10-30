const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  const isValidDate = (dateString) => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  };
  
  const isValidAmount = (amount) => {
    return !isNaN(amount) && parseFloat(amount) > 0;
  };
  
  module.exports = {
    isValidEmail,
    isValidDate,
    isValidAmount
  };