# OpenDesk

OpenDesk is a secure, open-source remote desktop web application using Encore.ts and Supabase. It aims to be a free, lightweight alternative to TeamViewer — built with simplicity, security, and local-first data handling in mind.

## Features

- **Secure P2P Connections**: All streaming and input data is sent directly between peers using WebRTC, ensuring privacy.
- **Role-Based Access**: Clear distinction between a 'host' (sharing their screen) and a 'controller' (viewing and controlling).
- **Session Management**: Create, join, and manage remote sessions with unique codes or shareable links.
- **Real-time Communication**: Integrated chat and signaling via Supabase Realtime.
- **File Transfer**: Securely transfer files between session participants.
- **Clipboard Sync**: Synchronize clipboard content between host and controller.
- **Full Control**: Keyboard and mouse input from the controller is sent to the host.

## Getting Started

To run OpenDesk, you need to set up a Supabase project for the database and authentication, and configure both the frontend and backend.

### 1. Set Up Supabase

1.  Go to [supabase.com](https://supabase.com), create a new project.
2.  Navigate to the **SQL Editor** in your Supabase project dashboard.
3.  Copy the entire content of `supabase/schema.sql` from this repository and run it in the SQL editor. This will create the necessary tables and policies.

### 2. Configure the Frontend

The frontend needs to connect to your Supabase project.

1.  Create a file named `.env` inside the `frontend/` directory.
2.  Add your Supabase project URL and anon key to this file:

    ```env
    VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
    VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
    ```

    You can find these keys in your Supabase project's **Settings > API** page.

### 3. Configure the Backend

The Encore backend requires secrets to interact with Supabase securely.

1.  In the Leap UI, navigate to the **Infrastructure** tab.
2.  Add the following secrets:
    -   `SupabaseURL`: Your Supabase project URL (the same one from the `.env` file).
    -   `SupabaseServiceRoleKey`: Your Supabase `service_role` key. Found in **Settings > API**.
    -   `SupabaseJWTSecret`: Your project's JWT Secret. Found in **Settings > API > JWT Settings**.

After completing these steps, your OpenDesk application should be fully configured and ready to run.

## Architecture

-   **Backend**: An [Encore.ts](https://encore.dev/docs/ts) application that provides a type-safe API for session management, signaling, and chat.
-   **Frontend**: A [React](https://react.dev/) application built with [Vite](https://vitejs.dev/) and styled with [Tailwind CSS](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/).
-   **Database & Auth**: [Supabase](https://supabase.com/) handles user authentication, database storage, and real-time event broadcasting for signaling and chat.
-   **P2P Communication**: [WebRTC](https://webrtc.org/) is used for direct peer-to-peer video/audio streaming and data channels.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
