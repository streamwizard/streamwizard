import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { discordInviteLink } from "@/lib/constant";

export default function NotWhitelisted() {
  return (
    <div className="min-h-screen flex items-center justify-center ">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Access Restricted</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-4">We&apos;re sorry, but you&apos;re not currently on the whitelist for this application.</p>
          <p className="mb-4">To request access, please join our Discord community and ask an administrator.</p>
          <Link href={discordInviteLink} target="_blank">
            <Button className="mb-4" variant="outline">
              Join our Discord
            </Button>
          </Link>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/login" passHref>
            <Button>Go to Login</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
