class Category {
  constructor(data = {}) {
    this.category_id = data.category_id || null;
    this.categoryName = data.categoryName || null;
    this.categoryIcon = data.categoryIcon || '📄';
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  // Static methods for database operations
  static async findAll() {
    // Get all categories
  }

  static async findById(categoryId) {
    // Get single category
  }

  static async getPopularCategories() {
    // Get categories ordered by usage
  }

  // Static category data (fallback/default categories)
  static getDefaultCategories() {
    return [
      { categoryName: 'Food', categoryIcon: '🍽️' },
      { categoryName: 'Entertainment', categoryIcon: '🎬' },
      { categoryName: 'Transport', categoryIcon: '🚗' },
      { categoryName: 'Beverage', categoryIcon: '🥤' },
      { categoryName: 'Shopping', categoryIcon: '🛍️' },
      { categoryName: 'Health', categoryIcon: '🏥' },
      { categoryName: 'Education', categoryIcon: '📚' },
      { categoryName: 'Other', categoryIcon: '📄' }
    ];
  }

  // Instance methods
  toJSON() {
    return {
      category_id: this.category_id,
      categoryName: this.categoryName,
      categoryIcon: this.categoryIcon,
      name: this.categoryName, // alias for compatibility
      icon: this.categoryIcon  // alias for compatibility
    };
  }

  // Validation methods
  static validateCategoryData(data) {
    const errors = [];
    
    if (!data.categoryName || data.categoryName.trim().length < 2) {
      errors.push('Category name must be at least 2 characters');
    }
    
    if (!data.categoryIcon) {
      errors.push('Category icon is required');
    }
    
    return errors;
  }
}

module.exports = Category;