import { useState, useEffect } from "react";

const NotesSection = () => {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [notes, setNotes] = useState({});
  const [file, setFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [previewNote, setPreviewNote] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const subjects = {
    9: ["Maths", "Science", "English", "Social Science","Hindi"],
    10: ["Maths", "Science", "English", "Social Science", "Hindi"],
    11: ["Physics", "Chemistry", "Maths", "Biology", "Computer Science", "English"],
    12: ["Physics", "Chemistry", "Maths", "Biology", "Computer Science", "English"],
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleUpload = () => {
    if (selectedClass && selectedSubject && file) {
      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          
          const key = `${selectedClass}-${selectedSubject}`;
          const newNote = {
            id: Date.now(),
            name: file.name,
            size: (file.size / 1024).toFixed(2) + " KB",
            date: new Date().toLocaleDateString(),
            type: file.type,
            content: URL.createObjectURL(file), // Create a URL for the file content
          };
          
          setNotes((prev) => ({
            ...prev,
            [key]: [...(prev[key] || []), newNote],
          }));
          
          setFile(null);
          setUploadProgress(0);
        }
      }, 100);
    } else {
      alert("⚠️ Please select class, subject and choose a file.");
    }
  };

  const handleViewNote = (note) => {
    setPreviewNote(note);
    setShowPreview(true);
  };

  const handleDownloadNote = (note) => {
    // Create a temporary anchor element
    const a = document.createElement('a');
    a.href = note.content;
    a.download = note.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredNotes = selectedClass && selectedSubject 
    ? (notes[`${selectedClass}-${selectedSubject}`] || []).filter(note => 
        note.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const clearFilters = () => {
    setSelectedClass("");
    setSelectedSubject("");
    setSearchQuery("");
  };

  return (
    <div className={`min-h-screen p-6 transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-gray-50 to-gray-100'}`}>
      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className={`rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                {previewNote?.name}
              </h3>
              <button 
                onClick={() => setShowPreview(false)}
                className={`p-1 rounded-full ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-500'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[80vh]">
              {previewNote?.type?.startsWith('image/') ? (
                <img 
                  src={previewNote.content} 
                  alt={previewNote.name} 
                  className="max-w-full h-auto mx-auto"
                />
              ) : (
                <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <p className={`text-center ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Preview not available for this file type. Download to view.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={() => handleDownloadNote(previewNote)}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-lg flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 mb-2">
              Notes Repository 📚
            </h1>
            <p className={`${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Access and share study materials for your classes
            </p>
          </div>
          
          <button 
            onClick={toggleDarkMode}
            className={`mt-4 md:mt-0 rounded-full p-2 ${darkMode ? 'bg-gray-700 text-yellow-300' : 'bg-gray-200 text-gray-700'}`}
          >
            {darkMode ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Selection Card */}
        <div>
          <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} border-0 shadow-lg rounded-2xl overflow-hidden`}>
            <div className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                  Upload New Notes
                </h2>
                
                {(selectedClass || selectedSubject || searchQuery) && (
                  <button 
                    onClick={clearFilters}
                    className={`flex items-center text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear Filters
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={`text-sm font-medium mb-2 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Class
                  </label>
                  <select 
                    onChange={(e) => setSelectedClass(e.target.value)} 
                    value={selectedClass}
                    className={`w-full py-2 px-3 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <option value="">Select Class</option>
                    {[9, 10, 11, 12].map((cls) => (
                      <option key={cls} value={cls.toString()}>
                        Class {cls}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedClass && (
                  <div>
                    <label className={`text-sm font-medium mb-2 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Subject
                    </label>
                    <select 
                      onChange={(e) => setSelectedSubject(e.target.value)} 
                      value={selectedSubject}
                      className={`w-full py-2 px-3 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <option value="">Select Subject</option>
                      {subjects[selectedClass]?.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className={`text-sm font-medium mb-2 block ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    File
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="file"
                        className={`w-full py-2 px-3 rounded-xl border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                        onChange={(e) => setFile(e.target.files[0])}
                      />
                      {file && (
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={handleUpload} 
                      className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-2 px-4 rounded-xl shadow-md flex items-center"
                      disabled={!selectedClass || !selectedSubject || !file}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload
                    </button>
                  </div>
                </div>
              </div>
              
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2">
                  <div className={`w-full rounded-full h-2.5 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notes Display */}
        {selectedClass && selectedSubject && (
          <div className="mt-8">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} border-0 shadow-lg rounded-2xl overflow-hidden`}>
              <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h2 className={`text-xl font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                    Notes for Class {selectedClass} - {selectedSubject}
                    <span className={`text-sm ml-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      ({filteredNotes.length} files)
                    </span>
                  </h2>
                  
                  <div className="relative w-full md:w-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      placeholder="Search notes..."
                      className={`pl-10 py-2 rounded-xl border w-full md:w-64 ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200'}`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                
                {filteredNotes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredNotes.map((note) => (
                      <div
                        key={note.id}
                        className={`rounded-xl p-4 border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} transition-transform hover:scale-[1.02]`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className={`text-xs px-2 py-1 rounded-full ${darkMode ? 'text-gray-300 bg-gray-600' : 'text-gray-500 bg-gray-100'}`}>
                            {note.type.split('/')[1]?.toUpperCase() || "FILE"}
                          </span>
                        </div>
                        
                        <h3 className={`font-medium truncate mb-1 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                          {note.name}
                        </h3>
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            <div>{note.size}</div>
                            <div>{note.date}</div>
                          </div>
                          
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => handleViewNote(note)}
                              className={`h-8 w-8 rounded-lg flex items-center justify-center ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors`}
                              title="View note"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => handleDownloadNote(note)}
                              className={`h-8 w-8 rounded-lg flex items-center justify-center ${darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'} transition-colors`}
                              title="Download note"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className={`text-lg font-medium mb-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      No notes found
                    </h3>
                    <p className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                      {searchQuery 
                        ? "Try a different search term" 
                        : "Upload the first note for this subject!"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesSection;