import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import AmbientBackground from "../ui/AmbientBackground";

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <AmbientBackground />
      <Header />

      <main className="relative container mx-auto px-6 py-8">
        {/* Hero */}
        <section className="mb-8">
          <div className="rounded-2xl border border-emerald-500/10 bg-gradient-to-br from-emerald-500/5 to-transparent dark:from-emerald-400/5 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
                  Welcome back
                </h1>
                <p className="text-muted-foreground">
                  Manage your remote sessions and share secure access with others.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="border-emerald-500/20 text-foreground hover:bg-emerald-500/10"
                  onClick={() => setJoinDialogOpen(true)}
                >
                  Join Session
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-600/90 text-white shadow-sm"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Session
                </Button>
                <UserMenu />
              </div>
            </div>
          </div>
        </section>

        {/* Promo */}
        <section className="mb-8">
          <Card className="border-emerald-500/10 bg-card/60 backdrop-blur supports-[backdrop-filter]:bg-card/50">
            <CardContent className="py-4 px-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                OpenDesk is open-source. Star us to support the project.
              </p>
              <Button
                variant="outline"
                className="border-emerald-500/20 hover:bg-emerald-500/10"
                onClick={() => window.open(GITHUB_URL, "_blank")}
              >
                <Github className="h-4 w-4 mr-2 text-emerald-500" />
                Star on GitHub
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Content */}
        <section>
          <Tabs defaultValue="active" className="space-y-6">
            <TabsList className="bg-muted/30 border border-emerald-500/10">
              <TabsTrigger
                value="active"
                className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-foreground"
              >
                Active ({activeSessions.length})
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-foreground"
              >
                Pending ({pendingSessions.length})
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-foreground"
              >
                History ({pastSessions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeSessions.length === 0 ? (
                <Card className="border-emerald-500/10">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="text-center space-y-3">
                      <h3 className="text-lg font-medium">No active sessions</h3>
                      <p className="text-muted-foreground">
                        Create a new session or join an existing one.
                      </p>
                      <div className="flex items-center space-x-3 justify-center">
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
                          onClick={() => setCreateDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Session
                        </Button>
                        <Button
                          variant="outline"
                          className="border-emerald-500/20 hover:bg-emerald-500/10"
                          onClick={() => setJoinDialogOpen(true)}
                        >
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
                <Card className="border-emerald-500/10">
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
                <Card className="border-emerald-500/10">
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
        </section>
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
