// src/components/LandingPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="…">  {/* your existing container */}
      {/* logo + title… */}

      <div className="flex space-x-4">
        <button
          onClick={() => navigate('/login?role=tenant')}
          className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg"
        >
          I am a Tenant
        </button>

        <button
          onClick={() => navigate('/login?role=landlord')}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
        >
          I am a Landlord
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
