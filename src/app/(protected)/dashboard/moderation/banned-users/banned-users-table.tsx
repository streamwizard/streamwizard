"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, UserX, Clock, X, Ban } from "lucide-react";
import { toast } from "sonner";
import { getBannedUsers, getBannedUser, unbanUser, banUser, BannedUser } from "@/actions/twitch/moderation";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import TwitchSearchBar from "@/components/search-bars/twitch-channel-search";
import { ChannelSearchResult } from "@/types/twitch";

interface SearchedUserState {
  channel: ChannelSearchResult;
  bannedInfo: BannedUser | null;
}

export default function BannedUsersTable() {
  const [users, setUsers] = useState<BannedUser[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [searchedUser, setSearchedUser] = useState<SearchedUserState | null | undefined>(undefined);
  const [isSearching, setIsSearching] = useState(false);

  // Ban dialog state
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banType, setBanType] = useState<"permanent" | "timeout">("permanent");
  const [banDuration, setBanDuration] = useState<string>("600"); // 10 min default
  const [banReason, setBanReason] = useState("");
  const [isBanning, setIsBanning] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    const result = await getBannedUsers({ first: 50 });
    if (result.success && result.data) {
      setUsers(result.data.users);
      setCursor(result.data.cursor);
    } else {
      toast.error(result.message);
    }
    setIsLoading(false);
  }

  async function loadMore() {
    if (!cursor) return;
    const result = await getBannedUsers({ cursor, first: 50 });
    if (result.success && result.data) {
      setUsers((prev) => [...prev, ...result.data!.users]);
      setCursor(result.data.cursor);
    } else {
      toast.error(result.message);
    }
  }

  async function handleSearch(channel: ChannelSearchResult) {
    setIsSearching(true);
    const result = await getBannedUser(channel.id);
    if (result.success) {
      setSearchedUser({
        channel,
        bannedInfo: result.data ?? null,
      });
      if (!result.data) {
        // User is not banned - no toast needed, we'll show ban option
      }
    } else {
      toast.error(result.message);
    }
    setIsSearching(false);
  }

  function clearSearch() {
    setSearchedUser(null);
  }

  function openBanDialog() {
    setBanType("permanent");
    setBanDuration("600");
    setBanReason("");
    setBanDialogOpen(true);
  }

  async function handleBan() {
    if (!searchedUser) return;

    setIsBanning(true);
    const result = await banUser({
      userId: searchedUser.channel.id,
      duration: banType === "timeout" ? parseInt(banDuration) : undefined,
      reason: banReason || undefined,
    });

    if (result.success) {
      toast.success(banType === "timeout" ? `${searchedUser.channel.display_name} has been put in timeout` : `${searchedUser.channel.display_name} has been banned`);
      setBanDialogOpen(false);
      // Refresh the search to show updated status
      await handleSearch(searchedUser.channel);
      // Also refresh the list
      loadUsers();
    } else {
      toast.error(result.message);
    }
    setIsBanning(false);
  }

  function handleUnban(userId: string, userName: string) {
    startTransition(async () => {
      const result = await unbanUser(userId);
      if (result.success) {
        setUsers((prev) => prev.filter((u) => u.user_id !== userId));
        if (searchedUser?.bannedInfo?.user_id === userId) {
          setSearchedUser((prev) => (prev ? { ...prev, bannedInfo: null } : null));
        }
        toast.success(`${userName} has been unbanned`);
      } else {
        toast.error(result.message);
      }
    });
  }

  function isTimeout(user: BannedUser): boolean {
    return user.expires_at !== "";
  }

  function formatBanDate(dateString: string): string {
    try {
      const date = parseISO(dateString);
      return format(date, "MMM d, yyyy 'at' h:mm a");
    } catch {
      return dateString;
    }
  }

  function formatExpiresAt(dateString: string): string {
    if (!dateString) return "Permanent";
    try {
      const date = parseISO(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return dateString;
    }
  }

  function renderUserRow(user: BannedUser) {
    return (
      <TableRow key={user.user_id}>
        <TableCell>
          <div>
            <p className="font-medium">{user.user_name}</p>
            <p className="text-sm text-muted-foreground">@{user.user_login}</p>
          </div>
        </TableCell>
        <TableCell>
          {isTimeout(user) ? (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              Timeout {formatExpiresAt(user.expires_at)}
            </Badge>
          ) : (
            <Badge variant="destructive">Banned</Badge>
          )}
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground max-w-[200px] truncate block">{user.reason || "No reason provided"}</span>
        </TableCell>
        <TableCell>
          <span className="text-sm">{user.moderator_name}</span>
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground">{formatBanDate(user.created_at)}</span>
        </TableCell>
        <TableCell className="text-right">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isPending}>
                Unban
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unban {user.user_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the {isTimeout(user) ? "timeout" : "ban"} from {user.user_name}. They will be able to chat in your channel again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleUnban(user.user_id, user.user_name)}>Unban</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TableCell>
      </TableRow>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ban Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {searchedUser?.channel.display_name}</DialogTitle>
            <DialogDescription>Ban this user from chatting in your channel or put them in a timeout.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ban Type</Label>
              <Select value={banType} onValueChange={(v) => setBanType(v as "permanent" | "timeout")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="permanent">Permanent Ban</SelectItem>
                  <SelectItem value="timeout">Timeout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {banType === "timeout" && (
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={banDuration} onValueChange={setBanDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                    <SelectItem value="600">10 minutes</SelectItem>
                    <SelectItem value="1800">30 minutes</SelectItem>
                    <SelectItem value="3600">1 hour</SelectItem>
                    <SelectItem value="86400">24 hours</SelectItem>
                    <SelectItem value="604800">1 week</SelectItem>
                    <SelectItem value="1209600">2 weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea placeholder="Enter a reason for the ban..." value={banReason} onChange={(e) => setBanReason(e.target.value)} maxLength={500} />
              <p className="text-xs text-muted-foreground">{banReason.length}/500 characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)} disabled={isBanning}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBan} disabled={isBanning}>
              {isBanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
              {banType === "timeout" ? "Timeout" : "Ban"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle>Search User</CardTitle>
          <CardDescription>Search for any Twitch user to check their ban status or ban them.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <TwitchSearchBar placeholder="Search for a user..." button_label="Check" onSelect={handleSearch} disabled={isSearching} />
          </div>
          {isSearching && (
            <div className="flex items-center gap-2 mt-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Checking ban status...</span>
            </div>
          )}
          {searchedUser && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Search Result</h4>
                <Button variant="ghost" size="sm" onClick={clearSearch}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {searchedUser.bannedInfo ? (
                // User is banned - show their info
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Banned By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{renderUserRow(searchedUser.bannedInfo)}</TableBody>
                </Table>
              ) : (
                // User is not banned - show ban option
                <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <UserX className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{searchedUser.channel.display_name}</p>
                      <p className="text-sm text-muted-foreground">This user is not banned</p>
                    </div>
                  </div>
                  <Button variant="destructive" onClick={openBanDialog}>
                    <Ban className="h-4 w-4 mr-2" />
                    Ban User
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banned Users List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Banned Users</CardTitle>
              <CardDescription>
                Users who are banned or in timeout from your chat. {users.length} user{users.length !== 1 ? "s" : ""} loaded.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadUsers} disabled={isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <UserX className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No banned users</h3>
              <p className="text-sm text-muted-foreground">Your channel currently has no banned users or timeouts.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Banned By</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{users.map((user) => renderUserRow(user))}</TableBody>
              </Table>

              {cursor && (
                <div className="flex justify-center mt-4">
                  <Button variant="outline" onClick={loadMore} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Load More
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
