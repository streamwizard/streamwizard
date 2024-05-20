import Image from "next/image";
import Link from "next/link";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAuthForm } from "@/components/auth/login-form";
import { Metadata } from "next";


export const metadata: Metadata = {
  title: "Login",
  description: "Login in to your account to access your dashboard.",
};

export default function LoginPage() {
  return (
    <div className=" relative hidden  flex-col items-center h-screen justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative  h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="z-50 h-full flex justify-center items-center flex-col relative">
          <Image
            src="/logo.png"
            width={450}
            height={500}
            alt="Logo"
            style={{
              maxWidth: "100%",
              height: "auto",
            }}
          />
          <blockquote className="space-y-2 absolute bottom-0">
            <p className="text-lg">
              &ldquo;Yesterday is history, tomorrow is a mystery, but today is a gift. That is why it is called the present.&rdquo;
            </p>
            <footer className="text-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <footer>Master Oogway</footer>
                  </TooltipTrigger>
                  <TooltipContent className="relative">
                    <Image src="/memes/master-mo.png" alt="Master Mo" width={1000} height={1000} />
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
            <p className="text-sm text-muted-foreground">
              {/* Don't have an account? */}
              {/* <Link href="/register" className="underline underline-offset-4 hover:text-primary">
                Register
              </Link> */}
            </p>
          </div>
          <UserAuthForm redirect={null} />
          <p className="px-8 text-center text-sm text-muted-foreground">
            By clicking continue, you agree to our
            <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
              Terms of Service
            </Link>
            and
            <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
