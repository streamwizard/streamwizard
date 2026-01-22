import BannedUsersTable from "./banned-users-table";

export default function BannedUsersPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Banned Users</h1>
        <p className="text-muted-foreground">Manage users who are banned or in timeout from your chat.</p>
      </div>
      <BannedUsersTable />
    </div>
  );
}
