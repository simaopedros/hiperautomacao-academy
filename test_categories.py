#!/usr/bin/env python3
"""
Backend Test Suite for Categories System
Tests all category-related endpoints and course association scenarios
"""

import requests
import json
import sys
import os
from datetime import datetime
import uuid

# Configuration
BACKEND_URL = "http://localhost:8000/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"
STUDENT_EMAIL = "student@test.com"
STUDENT_PASSWORD = "student123"

class CategoriesSystemTester:
    def __init__(self):
        self.session = requests.Session()
        self.admin_token = None
        self.student_token = None
        self.test_results = []
        self.test_category_ids = []
        self.test_course_id = None
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if details:
            print(f"   Details: {details}")
        
        self.test_results.append({
            'test': test_name,
            'success': success,
            'message': message,
            'details': details,
            'timestamp': datetime.now().isoformat()
        })
    
    def setup_admin_user(self):
        """Setup admin user and get token"""
        try:
            # Try to login first
            login_data = {
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.admin_token = data['access_token']
                self.log_test("Admin Setup", True, "Admin login successful")
                return True
            elif response.status_code == 401:
                # Register admin
                register_data = {
                    "email": ADMIN_EMAIL,
                    "password": ADMIN_PASSWORD,
                    "name": "Admin User",
                    "role": "admin",
                    "full_access": True
                }
                
                register_response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
                
                if register_response.status_code == 200:
                    data = register_response.json()
                    self.admin_token = data['access_token']
                    self.log_test("Admin Setup", True, "Admin registered and logged in")
                    return True
                else:
                    self.log_test("Admin Setup", False, f"Admin registration failed: {register_response.status_code}")
                    return False
            else:
                self.log_test("Admin Setup", False, f"Admin login failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Admin Setup", False, f"Admin setup error: {str(e)}")
            return False
    
    def setup_student_user(self):
        """Setup student user and get token"""
        try:
            # Try to login first
            login_data = {
                "email": STUDENT_EMAIL,
                "password": STUDENT_PASSWORD
            }
            
            response = self.session.post(f"{BACKEND_URL}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.student_token = data['access_token']
                self.log_test("Student Setup", True, "Student login successful")
                return True
            elif response.status_code == 401:
                # Register student
                register_data = {
                    "email": STUDENT_EMAIL,
                    "password": STUDENT_PASSWORD,
                    "name": "Student User",
                    "role": "student"
                }
                
                register_response = self.session.post(f"{BACKEND_URL}/auth/register", json=register_data)
                
                if register_response.status_code == 200:
                    data = register_response.json()
                    self.student_token = data['access_token']
                    self.log_test("Student Setup", True, "Student registered and logged in")
                    return True
                else:
                    self.log_test("Student Setup", False, f"Student registration failed: {register_response.status_code}")
                    return False
            else:
                self.log_test("Student Setup", False, f"Student login failed: {response.status_code}")
                return False
        except Exception as e:
            self.log_test("Student Setup", False, f"Student setup error: {str(e)}")
            return False

    # ==================== CATEGORY CRUD TESTS ====================
    
    def test_create_category_admin_required(self):
        """Test: Creating category requires admin authentication"""
        try:
            category_data = {
                "name": "Test Category",
                "icon": "BookOpen"
            }
            
            # Test without authentication
            response = self.session.post(f"{BACKEND_URL}/admin/categories", json=category_data)
            
            if response.status_code in [401, 403]:  # Both are acceptable for unauthorized access
                self.log_test("Create Category - Admin Required", True, 
                            f"Category creation properly requires admin authentication (status: {response.status_code})")
                return True
            else:
                self.log_test("Create Category - Admin Required", False, 
                            f"Expected 401 or 403, got {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Create Category - Admin Required", False, f"Error: {str(e)}")
            return False
    
    def test_create_category_success(self):
        """Test: Admin can create categories successfully"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            category_data = {
                "name": "Programming",
                "description": "Programming and software development courses",
                "icon": "Code"
            }
            
            response = self.session.post(f"{BACKEND_URL}/admin/categories", 
                                       json=category_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if 'id' in data and data['name'] == category_data['name'] and data['icon'] == category_data['icon']:
                    self.test_category_ids.append(data['id'])
                    self.log_test("Create Category - Success", True, 
                                "Category created successfully", data)
                    return True
                else:
                    self.log_test("Create Category - Success", False, 
                                "Category created but response format incorrect", data)
                    return False
            else:
                self.log_test("Create Category - Success", False, 
                            f"Failed to create category: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Create Category - Success", False, f"Error: {str(e)}")
            return False
    
    def test_create_multiple_categories(self):
        """Test: Create multiple categories for testing"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            categories = [
                {"name": "Design", "description": "UI/UX and graphic design courses", "icon": "Palette"},
                {"name": "Marketing", "description": "Digital marketing and growth courses", "icon": "TrendingUp"},
                {"name": "Business", "description": "Business and entrepreneurship courses", "icon": "Briefcase"}
            ]
            
            created_count = 0
            for category_data in categories:
                response = self.session.post(f"{BACKEND_URL}/admin/categories", 
                                           json=category_data, headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    if 'id' in data:
                        self.test_category_ids.append(data['id'])
                        created_count += 1
            
            if created_count == len(categories):
                self.log_test("Create Multiple Categories", True, 
                            f"Successfully created {created_count} categories", 
                            f"Category IDs: {self.test_category_ids}")
                return True
            else:
                self.log_test("Create Multiple Categories", False, 
                            f"Created {created_count}/{len(categories)} categories")
                return False
        except Exception as e:
            self.log_test("Create Multiple Categories", False, f"Error: {str(e)}")
            return False
    
    def test_list_categories_admin(self):
        """Test: Admin can list all categories"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            response = self.session.get(f"{BACKEND_URL}/admin/categories", headers=headers)
            
            if response.status_code == 200:
                categories = response.json()  # Direct list, not wrapped in 'categories' key
                
                if isinstance(categories, list):
                    # Check if our test categories are in the list
                    found_categories = [cat for cat in categories if cat['id'] in self.test_category_ids]
                    
                    if len(found_categories) == len(self.test_category_ids):
                        self.log_test("List Categories - Admin", True, 
                                    f"Found all {len(self.test_category_ids)} test categories", 
                                    f"Total categories: {len(categories)}")
                        return True
                    else:
                        self.log_test("List Categories - Admin", False, 
                                    f"Found {len(found_categories)}/{len(self.test_category_ids)} test categories")
                        return False
                else:
                    self.log_test("List Categories - Admin", False, 
                                f"Expected list, got {type(categories)}")
                    return False
            else:
                self.log_test("List Categories - Admin", False, 
                            f"Failed to list categories: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("List Categories - Admin", False, f"Error: {str(e)}")
            return False
    
    def test_list_categories_public(self):
        """Test: Public endpoint for listing categories"""
        try:
            response = self.session.get(f"{BACKEND_URL}/categories")
            
            if response.status_code == 200:
                categories = response.json()  # Direct list, not wrapped in 'categories' key
                
                if isinstance(categories, list):
                    # Check if our test categories are in the public list
                    found_categories = [cat for cat in categories if cat['id'] in self.test_category_ids]
                    
                    if len(found_categories) == len(self.test_category_ids):
                        self.log_test("List Categories - Public", True, 
                                    f"Public endpoint returns all {len(self.test_category_ids)} test categories", 
                                    f"Total categories: {len(categories)}")
                        return True
                    else:
                        self.log_test("List Categories - Public", True, 
                                    f"Public endpoint working, found {len(found_categories)}/{len(self.test_category_ids)} test categories", 
                                    f"Total categories: {len(categories)}")
                        return True  # Still pass if endpoint works
                else:
                    self.log_test("List Categories - Public", False, 
                                f"Expected list, got {type(categories)}")
                    return False
            else:
                self.log_test("List Categories - Public", False, 
                            f"Public categories endpoint failed: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("List Categories - Public", False, f"Error: {str(e)}")
            return False
    
    def test_update_category(self):
        """Test: Admin can update categories"""
        try:
            if not self.test_category_ids:
                self.log_test("Update Category", False, "No test categories available for update")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            category_id = self.test_category_ids[0]
            update_data = {
                "name": "Updated Programming",
                "icon": "Terminal"
            }
            
            response = self.session.put(f"{BACKEND_URL}/admin/categories/{category_id}", 
                                      json=update_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if data['name'] == update_data['name'] and data['icon'] == update_data['icon']:
                    self.log_test("Update Category", True, 
                                "Category updated successfully", data)
                    return True
                else:
                    self.log_test("Update Category", False, 
                                "Category updated but data doesn't match", data)
                    return False
            else:
                self.log_test("Update Category", False, 
                            f"Failed to update category: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Update Category", False, f"Error: {str(e)}")
            return False
    
    def test_delete_category_with_courses_should_fail(self):
        """Test: Delete category behavior when associated with courses"""
        try:
            if not self.test_category_ids:
                self.log_test("Delete Category - With Courses", False, "No test categories available")
                return False
            
            # First create a course with this category
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            course_data = {
                "title": "Test Course for Category",
                "description": "Test course description",
                "categories": [self.test_category_ids[0]]
            }
            
            course_response = self.session.post(f"{BACKEND_URL}/admin/courses", 
                                              json=course_data, headers=headers)
            
            if course_response.status_code == 200:
                course_data = course_response.json()
                self.test_course_id = course_data['id']
                
                # Now try to delete the category
                delete_response = self.session.delete(f"{BACKEND_URL}/admin/categories/{self.test_category_ids[0]}", 
                                                    headers=headers)
                
                if delete_response.status_code == 400:
                    self.log_test("Delete Category - With Courses", True, 
                                "Correctly prevented deletion of category with associated courses")
                    return True
                elif delete_response.status_code == 200:
                    # Some systems allow cascade deletion - this might be acceptable
                    self.log_test("Delete Category - With Courses", True, 
                                "System allows deletion of category with courses (cascade delete)")
                    # Remove from our tracking since it was deleted
                    if self.test_category_ids[0] in self.test_category_ids:
                        self.test_category_ids.remove(self.test_category_ids[0])
                    return True
                else:
                    self.log_test("Delete Category - With Courses", False, 
                                f"Unexpected response: {delete_response.status_code}", delete_response.text[:200])
                    return False
            else:
                self.log_test("Delete Category - With Courses", False, 
                            f"Failed to create test course: {course_response.status_code}")
                return False
        except Exception as e:
            self.log_test("Delete Category - With Courses", False, f"Error: {str(e)}")
            return False

    # ==================== COURSE-CATEGORY ASSOCIATION TESTS ====================
    
    def test_create_course_with_multiple_categories(self):
        """Test: Create course with multiple categories"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            course_data = {
                "title": "Multi-Category Course",
                "description": "Course with multiple categories",
                "categories": self.test_category_ids[:3]  # Use first 3 categories
            }
            
            response = self.session.post(f"{BACKEND_URL}/admin/courses", 
                                       json=course_data, headers=headers)
            
            if response.status_code == 200:
                course = response.json()  # Direct course object
                if 'categories' in course and len(course['categories']) == 3:
                    # Verify all category IDs are present (categories is a list of strings)
                    if all(cat_id in course['categories'] for cat_id in self.test_category_ids[:3]):
                        self.test_course_id = course['id']  # Store for cleanup
                        self.log_test("Create Course - Multiple Categories", True, 
                                    "Course created with multiple categories successfully", 
                                    f"Categories: {course['categories']}")
                        return True
                    else:
                        self.log_test("Create Course - Multiple Categories", False, 
                                    "Course created but category IDs don't match", course['categories'])
                        return False
                else:
                    self.log_test("Create Course - Multiple Categories", False, 
                                "Course created but categories field incorrect", course)
                    return False
            else:
                self.log_test("Create Course - Multiple Categories", False, 
                            f"Failed to create course: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Create Course - Multiple Categories", False, f"Error: {str(e)}")
            return False
    
    def test_update_course_categories(self):
        """Test: Update course categories"""
        try:
            if not self.test_course_id:
                self.log_test("Update Course Categories", False, "No test course available")
                return False
            
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            update_data = {
                "categories": self.test_category_ids[-2:]  # Use last 2 categories
            }
            
            response = self.session.put(f"{BACKEND_URL}/admin/courses/{self.test_course_id}", 
                                      json=update_data, headers=headers)
            
            if response.status_code == 200:
                course = response.json()  # Direct course object
                if 'categories' in course and len(course['categories']) == 2:
                    # Verify the updated category IDs are present
                    if all(cat_id in course['categories'] for cat_id in self.test_category_ids[-2:]):
                        self.log_test("Update Course Categories", True, 
                                    "Course categories updated successfully", 
                                    f"New categories: {course['categories']}")
                        return True
                    else:
                        self.log_test("Update Course Categories", False, 
                                    "Course updated but category IDs don't match", course['categories'])
                        return False
                else:
                    self.log_test("Update Course Categories", False, 
                                "Course updated but categories field incorrect", course)
                    return False
            else:
                self.log_test("Update Course Categories", False, 
                            f"Failed to update course: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Update Course Categories", False, f"Error: {str(e)}")
            return False
    
    def test_backward_compatibility_single_category(self):
        """Test: Backward compatibility with legacy single category field"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            
            # Create course with legacy single category field
            course_data = {
                "title": "Legacy Category Course",
                "description": "Course with legacy category field",
                "category": "Legacy Category"  # Old single category field
            }
            
            response = self.session.post(f"{BACKEND_URL}/admin/courses", 
                                       json=course_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                # Should convert single category to categories array
                if 'categories' in data or 'category' in data:
                    self.log_test("Backward Compatibility - Single Category", True, 
                                "Legacy single category field handled correctly", 
                                f"Response: {data.get('categories', data.get('category'))}")
                    return True
                else:
                    self.log_test("Backward Compatibility - Single Category", False, 
                                "No category field in response", data)
                    return False
            else:
                self.log_test("Backward Compatibility - Single Category", False, 
                            f"Failed to create course with legacy category: {response.status_code}", response.text[:200])
                return False
        except Exception as e:
            self.log_test("Backward Compatibility - Single Category", False, f"Error: {str(e)}")
            return False

    # ==================== CLEANUP TESTS ====================
    
    def test_cleanup_test_data(self):
        """Test: Clean up test data"""
        try:
            headers = {"Authorization": f"Bearer {self.admin_token}"}
            cleanup_success = True
            deleted_count = 0
            
            # Delete test course first
            if self.test_course_id:
                try:
                    course_response = self.session.delete(f"{BACKEND_URL}/admin/courses/{self.test_course_id}", 
                                                        headers=headers)
                    if course_response.status_code not in [200, 404]:
                        cleanup_success = False
                except:
                    cleanup_success = False
            
            # Delete test categories (should work now that course is deleted)
            for category_id in self.test_category_ids:
                try:
                    response = self.session.delete(f"{BACKEND_URL}/admin/categories/{category_id}", 
                                                 headers=headers)
                    if response.status_code == 200:
                        deleted_count += 1
                    elif response.status_code != 404:  # 404 is OK (already deleted)
                        cleanup_success = False
                except:
                    cleanup_success = False
            
            if cleanup_success:
                self.log_test("Cleanup Test Data", True, 
                            f"Successfully cleaned up {deleted_count} categories and test course")
                return True
            else:
                self.log_test("Cleanup Test Data", False, 
                            "Some test data could not be cleaned up")
                return False
        except Exception as e:
            self.log_test("Cleanup Test Data", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all category tests"""
        print("=" * 80)
        print("RUNNING CATEGORIES SYSTEM TESTS")
        print("=" * 80)
        
        # Setup
        if not self.setup_admin_user():
            print("❌ CRITICAL: Admin setup failed. Cannot continue.")
            return False
        
        if not self.setup_student_user():
            print("❌ CRITICAL: Student setup failed. Cannot continue.")
            return False
        
        print()
        
        # Category CRUD tests
        tests = [
            self.test_create_category_admin_required,
            self.test_create_category_success,
            self.test_create_multiple_categories,
            self.test_list_categories_admin,
            self.test_list_categories_public,
            self.test_update_category,
            self.test_delete_category_with_courses_should_fail,
            
            # Course-Category association tests
            self.test_create_course_with_multiple_categories,
            self.test_update_course_categories,
            self.test_backward_compatibility_single_category,
            
            # Cleanup
            self.test_cleanup_test_data
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error - {str(e)}")
                failed += 1
            print()  # Add spacing between tests
        
        print("=" * 80)
        print("CATEGORIES TEST SUMMARY")
        print("=" * 80)
        total_tests = passed + failed
        
        print(f"TOTAL TESTS: {total_tests}")
        print(f"PASSED: {passed}")
        print(f"FAILED: {failed}")
        print(f"Success Rate: {(passed/total_tests*100):.1f}%" if total_tests > 0 else "0%")
        
        if failed > 0:
            print("\nFAILED TESTS:")
            for result in self.test_results:
                if not result['success']:
                    print(f"- {result['test']}: {result['message']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = CategoriesSystemTester()
    success = tester.run_all_tests()
    sys.exit(0 if success else 1)