import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Settings, LogOut, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Header from "./Header";
import SessionCard from "./SessionCard";
import CreateSessionDialog from "./CreateSessionDialog";
import JoinSessionDialog from "./JoinSessionDialog";
import UserMenu from "./UserMenu";
import { useBackend } from "../../hooks/useBackend";
import { useToast } from "@/components/ui/use-toast";
import LoadingSpinner from "../ui/LoadingSpinner";
import { GITHUB_URL } from "../../config";

export default function Dashboard() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const backend = useBackend();
  const { toast } = useToast();

  const { data: sessionsData, isLoading, error, refetch } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      try {
        return await backend.session.listMySessions();
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load sessions. Please try again.",
        });
        throw error;
      }
    },
  });

  const activeSessions = sessionsData?.sessions.filter(s => s.status === "active") || [];
  const pastSessions = sessionsData?.sessions.filter(s => s.status === "ended") || [];
  const pendingSessions = sessionsData?.sessions.filter(s => s.status === "pending") || [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your remote desktop sessions
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => window.open(GITHUB_URL, "_blank")}
            >
              <Github className="h-4 w-4 mr-2" />
              Star on GitHub
            </Button>
            <Button onClick={() => setJoinDialogOpen(true)}>
              Join Session
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
            <UserMenu />
          </div>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active">
              Active Sessions ({activeSessions.length})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending Sessions ({pendingSessions.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              Session History ({pastSessions.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeSessions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-center space-y-3">
                    <h3 className="text-lg font-medium">No active sessions</h3>
                    <p className="text-muted-foreground">
                      Create a new session or join an existing one to get started.
                    </p>
                    <div className="flex items-center space-x-3">
                      <Button onClick={() => setCreateDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Session
                      </Button>
                      <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>
                        Join Session
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeSessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={session} 
                    onRefresh={refetch}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {pendingSessions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-center space-y-3">
                    <h3 className="text-lg font-medium">No pending sessions</h3>
                    <p className="text-muted-foreground">
                      Pending sessions will appear here when created.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingSessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={session} 
                    onRefresh={refetch}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {pastSessions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="text-center space-y-3">
                    <h3 className="text-lg font-medium">No session history</h3>
                    <p className="text-muted-foreground">
                      Your completed sessions will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pastSessions.map((session) => (
                  <SessionCard 
                    key={session.id} 
                    session={session} 
                    onRefresh={refetch}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <CreateSessionDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refetch}
      />
      
      <JoinSessionDialog 
        open={joinDialogOpen}
        onOpenChange={setJoinDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
}
