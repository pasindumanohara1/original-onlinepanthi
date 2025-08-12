import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { LogOut, Menu, X, BookOpen, Film, FileText, FolderOpen, Plus, Edit, Trash2, Save, X as Close } from "lucide-react";

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('courses');
  const [courses, setCourses] = useState<any[]>([]);
  const [instructors, setInstructors] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [newCourse, setNewCourse] = useState({
    name: '',
    description: '',
    level: 'beginner',
    category: '',
    thumbnail_url: '',
    rate: '',
    students: 0,
    language: '',
    instructor_id: ''
  });

  useEffect(() => {
    // Check if user is authenticated and is an admin
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        navigate("/auth", { replace: true });
        return;
      }

      // Check if user is admin by checking user_profile table
      try {
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profile')
          .select('*')
          .eq('uid', session.user.id)
          .single();
          
        if (profileError || !userProfile) {
          console.error('Error fetching user profile:', profileError);
          navigate("/auth", { replace: true });
          return;
        }

        // For now, we'll assume all users are admins
        // In a real application, you would have an is_admin field in the user_profile table
        setUser(session.user);
        setIsAdmin(true);
        
        // Fetch courses and instructors
        await fetchCourses();
        await fetchInstructors();
      } catch (error) {
        console.error('Error checking admin status:', error);
        navigate("/", { replace: true });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  // Fetch courses from database
  const fetchCourses = async () => {
    try {
      setLoadingCourses(true);
      const { data, error } = await supabase
        .from('courses')
        .select(`
          *,
          instructor:instructor(name)
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  };

  // Fetch instructors from database
  const fetchInstructors = async () => {
    try {
      const { data, error } = await supabase
        .from('instructor')
        .select('*')
        .order('name');
        
      if (error) throw error;
      setInstructors(data || []);
    } catch (error) {
      console.error('Error fetching instructors:', error);
    }
  };

  // Delete a course
  const deleteCourse = async (courseId: string) => {
    if (!window.confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('uid', courseId);
        
      if (error) throw error;
      
      // Refresh courses list
      await fetchCourses();
      alert('Course deleted successfully');
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('Error deleting course');
    }
  };

  // Handle add course form submission
  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { data, error } = await supabase
        .from('courses')
        .insert([{
          name: newCourse.name,
          description: newCourse.description,
          level: newCourse.level,
          category: newCourse.category,
          thumbnail_url: newCourse.thumbnail_url,
          rate: newCourse.rate ? parseFloat(newCourse.rate) : null,
          students: 0,
          language: newCourse.language,
          instructor_id: newCourse.instructor_id || null
        }])
        .select()
        .single();
        
      if (error) throw error;
      
      // Reset form and close modal
      setNewCourse({
        name: '',
        description: '',
        level: 'beginner',
        category: '',
        thumbnail_url: '',
        rate: '',
        students: 0,
        language: '',
        instructor_id: ''
      });
      setShowAddCourseModal(false);
      
      // Refresh courses list
      await fetchCourses();
      alert('Course added successfully');
    } catch (error) {
      console.error('Error adding course:', error);
      alert('Error adding course');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ocean-600"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen pt-24">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
            <p className="text-gray-600 mt-2">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0 transition-transform duration-300 ease-in-out`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-xl font-bold text-ocean-700">Admin Panel</h1>
          <button 
            className="lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="mt-6">
          <a 
            href="#" 
            className={`flex items-center px-4 py-3 ${activeTab === 'courses' ? 'text-ocean-700 bg-ocean-50 border-l-4 border-ocean-600' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('courses'); }}
          >
            <BookOpen className="w-5 h-5 mr-3" />
            Courses
          </a>
          <a 
            href="#" 
            className={`flex items-center px-4 py-3 ${activeTab === 'topics' ? 'text-ocean-700 bg-ocean-50 border-l-4 border-ocean-600' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('topics'); }}
          >
            <FolderOpen className="w-5 h-5 mr-3" />
            Topics
          </a>
          <a 
            href="#" 
            className={`flex items-center px-4 py-3 ${activeTab === 'videos' ? 'text-ocean-700 bg-ocean-50 border-l-4 border-ocean-600' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('videos'); }}
          >
            <Film className="w-5 h-5 mr-3" />
            Videos
          </a>
          <a 
            href="#" 
            className={`flex items-center px-4 py-3 ${activeTab === 'resources' ? 'text-ocean-700 bg-ocean-50 border-l-4 border-ocean-600' : 'text-gray-600 hover:bg-gray-100'}`}
            onClick={(e) => { e.preventDefault(); setActiveTab('resources'); }}
          >
            <FileText className="w-5 h-5 mr-3" />
            Resources
          </a>
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-ocean-600 flex items-center justify-center text-white font-bold">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900">{user?.email}</p>
              <p className="text-xs text-gray-500">Admin</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-4 w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top navigation */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <button
                  className="lg:hidden text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu className="h-6 w-6" />
                </button>
              </div>
              <div className="flex items-center">
                <span className="text-lg font-semibold text-ocean-700">
                  {activeTab === 'courses' && 'Courses Management'}
                  {activeTab === 'topics' && 'Topics Management'}
                  {activeTab === 'videos' && 'Videos Management'}
                  {activeTab === 'resources' && 'Resources Management'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Courses Management */}
          {activeTab === 'courses' && (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">Courses Management</h2>
                <button 
                  className="flex items-center px-4 py-2 bg-ocean-600 text-white rounded-md hover:bg-ocean-700"
                  onClick={() => setShowAddCourseModal(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Course
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Language</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Instructor</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loadingCourses ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          Loading courses...
                        </td>
                      </tr>
                    ) : courses.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          No courses found
                        </td>
                      </tr>
                    ) : (
                      courses.map((course) => (
                        <tr key={course.uid}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{course.name}</div>
                            <div className="text-sm text-gray-500">{course.description?.substring(0, 50)}...</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {course.level}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {course.category || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {course.rate ? `${course.rate}/5` : '-' }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {course.language || '-' }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {course.instructor?.name || '-' }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-ocean-600 hover:text-ocean-900 mr-3">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              className="text-red-600 hover:text-red-900"
                              onClick={() => deleteCourse(course.uid)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Topics Management */}
          {activeTab === 'topics' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Topics Management</h2>
              <p className="text-gray-600">Select a course to view and manage its topics.</p>
            </div>
          )}

          {/* Videos Management */}
          {activeTab === 'videos' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Videos Management</h2>
              <p className="text-gray-600">Select a topic to view and manage its videos.</p>
            </div>
          )}

          {/* Resources Management */}
          {activeTab === 'resources' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Resources Management</h2>
              <p className="text-gray-600">Select a topic to view and manage its resources.</p>
            </div>
          )}
        </main>
      </div>

      {/* Add Course Modal */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Add New Course</h3>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-500"
                    onClick={() => setShowAddCourseModal(false)}
                  >
                    <Close className="h-6 w-6" />
                  </button>
                </div>
                
                <form onSubmit={handleAddCourse}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Course Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        value={newCourse.name}
                        onChange={(e) => setNewCourse({...newCourse, name: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-ocean-500 focus:border-ocean-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        rows={3}
                        value={newCourse.description}
                        onChange={(e) => setNewCourse({...newCourse, description: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-ocean-500 focus:border-ocean-500 sm:text-sm"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="level" className="block text-sm font-medium text-gray-700">
                          Level
                        </label>
                        <select
                          id="level"
                          name="level"
                          value={newCourse.level}
                          onChange={(e) => setNewCourse({...newCourse, level: e.target.value})}
                          className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-ocean-500 focus:border-ocean-500 sm:text-sm"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="ordinary">Ordinary</option>
                          <option value="advanced">Advanced</option>
                          <option value="highereducation">Higher Education</option>
                        </select>
                      </div>
                      
                      <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                          Category
                        </label>
                        <input
                          type="text"
                          id="category"
                          name="category"
                          value={newCourse.category}
                          onChange={(e) => setNewCourse({...newCourse, category: e.target.value})}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-ocean-500 focus:border-ocean-500 sm:text-sm"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="rate" className="block text-sm font-medium text-gray-700">
                          Rating (1-5)
                        </label>
                        <input
                          type="number"
                          id="rate"
                          name="rate"
                          min="1"
                          max="5"
                          step="0.1"
                          value={newCourse.rate}
                          onChange={(e) => setNewCourse({...newCourse, rate: e.target.value})}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-ocean-500 focus:border-ocean-500 sm:text-sm"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="language" className="block text-sm font-medium text-gray-700">
                          Language
                        </label>
                        <input
                          type="text"
                          id="language"
                          name="language"
                          value={newCourse.language}
                          onChange={(e) => setNewCourse({...newCourse, language: e.target.value})}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-ocean-500 focus:border-ocean-500 sm:text-sm"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="instructor" className="block text-sm font-medium text-gray-700">
                        Instructor
                      </label>
                      <select
                        id="instructor"
                        name="instructor_id"
                        value={newCourse.instructor_id}
                        onChange={(e) => setNewCourse({...newCourse, instructor_id: e.target.value})}
                        className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-ocean-500 focus:border-ocean-500 sm:text-sm"
                      >
                        <option value="">Select an instructor</option>
                        {instructors.map((instructor) => (
                          <option key={instructor.uid} value={instructor.uid}>
                            {instructor.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="thumbnail" className="block text-sm font-medium text-gray-700">
                        Thumbnail URL
                      </label>
                      <input
                        type="text"
                        id="thumbnail"
                        name="thumbnail_url"
                        value={newCourse.thumbnail_url}
                        onChange={(e) => setNewCourse({...newCourse, thumbnail_url: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-ocean-500 focus:border-ocean-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-500"
                      onClick={() => setShowAddCourseModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-ocean-600 hover:bg-ocean-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ocean-500"
                    >
                      Add Course
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;