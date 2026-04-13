// Page for /u/:username — resolves username to address and renders CreatorProfile
import { useParams, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useProfiles } from "@/lib/profileProvider";
import Navbar from "@/components/Navbar";

const UserProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const { fetchProfileByUsername } = useProfiles();
  const [address, setAddress] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const resolve = async () => {
      const profile = await fetchProfileByUsername(username);
      if (profile) {
        setAddress(profile.address);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    };
    resolve();
  }, [username, fetchProfileByUsername]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 px-4 flex justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (notFound || !address) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-24 pb-16 px-4 text-center">
          <p className="text-muted-foreground font-body text-lg">
            User <span className="text-primary font-display">@{username}</span> not found.
          </p>
        </div>
      </div>
    );
  }

  return <Navigate to={`/creator/${address}`} replace />;
};

export default UserProfilePage;
