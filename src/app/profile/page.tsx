"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { User, Clock, Star, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { format } from "date-fns";

const DIETARY_OPTIONS = ["vegetarian", "vegan", "gluten-free", "dairy-free", "keto", "paleo", "halal", "kosher"];
const ALLERGY_OPTIONS = ["nuts", "peanuts", "shellfish", "fish", "eggs", "dairy", "soy", "wheat", "sesame"];

interface UserProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  dietaryPreferences: string[];
  allergies: string[];
  createdAt: string;
}

interface CookLogEntry {
  id: string;
  cookedAt: string;
  rating?: number | null;
  recipe: { id: string; title: string; imageUrl?: string | null };
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);

  const { data: profile } = useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: () => fetch("/api/user/profile").then((r) => r.json()),
    enabled: !!session,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setSelectedDiets(profile.dietaryPreferences || []);
      setSelectedAllergies(profile.allergies || []);
    }
  }, [profile]);

  const { data: cookLog = [] } = useQuery<CookLogEntry[]>({
    queryKey: ["cook-log"],
    queryFn: () => fetch("/api/cook-log").then((r) => r.json()),
    enabled: !!session,
  });

  const updateProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          dietaryPreferences: selectedDiets,
          allergies: selectedAllergies,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
    },
  });

  const toggleTag = (tag: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  };

  if (!session) {
    return (
      <div className="text-center py-20">
        <User className="w-16 h-16 text-gray-200 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Sign in to view your profile</h2>
        <Link href="/auth/signin"><Button>Sign in</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <User className="w-6 h-6 text-orange-500" />
        My Profile
      </h1>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            {profile?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.image} alt="Avatar" className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                <User className="w-8 h-8 text-orange-500" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{profile?.name || "Anonymous"}</h2>
              <p className="text-sm text-gray-500">{profile?.email}</p>
              {profile?.createdAt && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Member since {format(new Date(profile.createdAt), "MMMM yyyy")}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Edit
          </button>
        </div>

        {editing ? (
          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Dietary Preferences</label>
              <div className="flex flex-wrap gap-2">
                {DIETARY_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => toggleTag(d, selectedDiets, setSelectedDiets)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                      selectedDiets.includes(d)
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Allergies</label>
              <div className="flex flex-wrap gap-2">
                {ALLERGY_OPTIONS.map((a) => (
                  <button
                    key={a}
                    onClick={() => toggleTag(a, selectedAllergies, setSelectedAllergies)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                      selectedAllergies.includes(a)
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => updateProfile.mutate()} loading={updateProfile.isPending}>
                Save Changes
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {profile?.dietaryPreferences && profile.dietaryPreferences.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Dietary Preferences
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.dietaryPreferences.map((d) => (
                    <Badge key={d} variant="green" className="capitalize">{d}</Badge>
                  ))}
                </div>
              </div>
            )}
            {profile?.allergies && profile.allergies.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Allergies
                </p>
                <div className="flex flex-wrap gap-2">
                  {profile.allergies.map((a) => (
                    <Badge key={a} variant="red" className="capitalize">{a}</Badge>
                  ))}
                </div>
              </div>
            )}
            {(!profile?.dietaryPreferences?.length && !profile?.allergies?.length) && (
              <p className="text-sm text-gray-400">
                No dietary preferences set.{" "}
                <button onClick={() => setEditing(true)} className="text-orange-500 hover:underline">
                  Add some
                </button>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Cook Log */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          Cook History ({cookLog.length})
        </h2>

        {cookLog.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No cooking history yet.</p>
            <p className="text-xs mt-1">
              Open a recipe and click &quot;I cooked this!&quot; to log it.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cookLog.map((log) => (
              <Link key={log.id} href={`/recipes/${log.recipe.id}`} className="block">
                <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 overflow-hidden">
                    {log.recipe.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={log.recipe.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">🍽️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{log.recipe.title}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(log.cookedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  {log.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium text-gray-700">{log.rating}</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
