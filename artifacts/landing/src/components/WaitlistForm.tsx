import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Loader2, ArrowRight } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

type WaitlistFormValues = z.infer<typeof waitlistSchema>;

export function WaitlistForm({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");

  const form = useForm<WaitlistFormValues>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: WaitlistFormValues) => {
    setStatus("loading");
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setStatus("success");
    // Form is not actually submitting anywhere, local state only as requested.
  };

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl flex items-center gap-3 ${className}`}
      >
        <div className="bg-green-500/20 p-2 rounded-full">
          <Check className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium text-green-300">You're on the list.</p>
          <p className="text-sm opacity-80">We'll notify you the moment we launch.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={`relative flex flex-col sm:flex-row gap-3 ${className}`}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="Enter your email address"
                    className="h-12 bg-black/40 border-border/60 focus:border-primary/50 focus:ring-primary/50 pl-4 pr-4 rounded-xl text-base w-full"
                    disabled={status === "loading"}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage className="text-red-400 absolute mt-1" />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          disabled={status === "loading"}
          className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-all group"
        >
          {status === "loading" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Join Waitlist
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
