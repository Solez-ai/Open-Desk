import { AlertTriangle, Github } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { APP_NAME, GITHUB_URL } from "../../config";

export default function ConfigurationError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <AlertTriangle className="h-12 w-12 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl">Configuration Required</CardTitle>
          <CardDescription>
            {APP_NAME} requires Supabase configuration to function properly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Supabase URL and anonymous key are not configured. The application cannot connect to the backend database.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Setup Instructions:</h3>
            
            <div className="space-y-3 text-sm">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">1. Create a Supabase Project</h4>
                <p>Visit <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">supabase.com</a> and create a new project.</p>
              </div>
              
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">2. Get Your Project Credentials</h4>
                <p>In your Supabase dashboard, go to Settings → API to find:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Project URL</li>
                  <li>anon/public key</li>
                </ul>
              </div>
              
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">3. Configure the Application</h4>
                <p>Update the configuration in one of these ways:</p>
                <div className="mt-2 space-y-2">
                  <div className="bg-background p-3 rounded border">
                    <p className="font-medium">Option A: Environment Variables</p>
                    <p className="text-xs text-muted-foreground mt-1">Set these environment variables in a <code>.env</code> file in the <code>frontend</code> directory:</p>
                    <code className="block mt-1 text-xs bg-gray-100 p-2 rounded">
                      VITE_SUPABASE_URL=your_project_url<br/>
                      VITE_SUPABASE_ANON_KEY=your_anon_key
                    </code>
                  </div>
                  <div className="bg-background p-3 rounded border">
                    <p className="font-medium">Option B: Update config.ts</p>
                    <p className="text-xs text-muted-foreground mt-1">Edit <code>frontend/config.ts</code> and set:</p>
                    <code className="block mt-1 text-xs bg-gray-100 p-2 rounded">
                      export const supabaseUrl = "your_project_url";<br/>
                      export const supabaseAnonKey = "your_anon_key";
                    </code>
                  </div>
                </div>
              </div>
              
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">4. Set Up Database Schema</h4>
                <p>Run the SQL schema from <code>supabase/schema.sql</code> in your Supabase SQL editor to create the required tables.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => window.open(GITHUB_URL, "_blank")}
            >
              <Github className="h-4 w-4 mr-2" />
              View Documentation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
