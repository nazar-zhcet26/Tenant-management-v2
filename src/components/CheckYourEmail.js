export default function CheckYourEmail() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="bg-white/10 backdrop-blur-lg p-8 rounded-xl border border-white/20 text-center text-white space-y-4">
                <h2 className="text-2xl font-semibold">Almost there!</h2>
                <p>We’ve sent a confirmation link to your email.</p>
                <p>Click that link to finish signing up.</p>
            </div>
        </div>
    );
}

