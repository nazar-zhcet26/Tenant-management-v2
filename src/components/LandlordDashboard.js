import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Home, AlertCircle, ClipboardList } from 'lucide-react';

const LandlordDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [properties, setProperties] = useState([]);
    const [reports, setReports] = useState({});
    const [loading, setLoading] = useState(true);

    // Check user session and fetch landlord-specific data
    useEffect(() => {
        const fetchUserData = async () => {
            const {
                data: { session },
                error
            } = await supabase.auth.getSession();

            if (error || !session) {
                navigate('/login');
                return;
            }

            const currentUser = session.user;
            setUser(currentUser);

            // Fetch properties owned by this landlord
            const { data: landlordProps, error: propError } = await supabase
                .from('properties')
                .select('*')
                .eq('landlord_id', currentUser.id);

            if (propError) {
                console.error('Error fetching properties:', propError.message);
                return;
            }

            setProperties(landlordProps);

            // For each property, fetch its maintenance reports
            const allReports = {};
            for (const prop of landlordProps) {
                const { data: propReports, error: reportError } = await supabase
                    .from('maintenance_reports')
                    .select('*')
                    .eq('property_id', prop.id);

                if (!reportError) {
                    allReports[prop.id] = propReports;
                }
            }

            setReports(allReports);
            setLoading(false);
        };

        fetchUserData();
    }, [navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-white">
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6">
            <h1 className="text-4xl font-bold mb-6 flex items-center gap-3">
                <ClipboardList className="w-8 h-8" />
                Landlord Dashboard
            </h1>

            {properties.length === 0 ? (
                <p className="text-gray-400">You have not added any properties yet.</p>
            ) : (
                properties.map((property) => (
                    <Card key={property.id} className="mb-6 bg-white/10 border-white/20 text-white">
                        <CardContent className="p-6">
                            <div className="flex items-center mb-4">
                                <Home className="text-blue-400 mr-2" />
                                <h2 className="text-2xl font-semibold">{property.name}</h2>
                            </div>
                            <p className="text-gray-300 mb-4">{property.address}</p>

                            {reports[property.id]?.length > 0 ? (
                                <ul className="space-y-3">
                                    {reports[property.id].map((report) => (
                                        <li
                                            key={report.id}
                                            className="p-4 rounded-lg bg-slate-700 border border-slate-500"
                                        >
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <p className="text-lg font-semibold">{report.title}</p>
                                                    <p className="text-sm text-gray-400">{report.description}</p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {new Date(report.created_at).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="text-sm px-3 py-1 rounded-full bg-yellow-600 text-white">
                                                    {report.status}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="flex items-center gap-2 text-gray-400">
                                    <AlertCircle className="w-5 h-5" />
                                    No reports submitted for this property.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    );
};

export default LandlordDashboard;