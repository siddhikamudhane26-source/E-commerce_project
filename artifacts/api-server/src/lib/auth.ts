import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { eq } from "drizzle-orm";
import { customersTable, db, type Customer } from "@workspace/db";
import { logger } from "./logger";

export type AuthenticatedRequest = Request & {
  customer?: Customer;
  clerkUserId?: string;
};

type ClerkUser = Awaited<ReturnType<typeof clerkClient.users.getUser>>;

async function getCurrentClerkUser(req: Request): Promise<ClerkUser | null> {
  const { userId } = getAuth(req);
  if (!userId) return null;
  return clerkClient.users.getUser(userId);
}

export async function getCurrentCustomer(req: Request): Promise<Customer | null> {
  const clerkUser = await getCurrentClerkUser(req);
  if (!clerkUser) return null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const [byClerkId] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.clerkUserId, clerkUser.id));
  let customer = byClerkId;

  if (!customer) {
    [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.email, email));
  }

  if (customer) {
    if (customer.clerkUserId !== clerkUser.id || customer.email !== email) {
      [customer] = await db
        .update(customersTable)
        .set({ clerkUserId: clerkUser.id, email })
        .where(eq(customersTable.id, customer.id))
        .returning();
    }
    return customer;
  }

  const [created] = await db
    .insert(customersTable)
    .values({
      clerkUserId: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || email.split("@")[0],
      email,
    })
    .returning();
  return created;
}

export const requireCustomer: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const customer = await getCurrentCustomer(req);
    if (!customer) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.customer = customer;
    req.clerkUserId = customer.clerkUserId ?? undefined;
    next();
  } catch (error) {
    logger.error({ error }, "Unable to resolve the current customer");
    res.status(401).json({ error: "Authentication required" });
  }
};

export const requireAdmin: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const clerkUser = await getCurrentClerkUser(req);
    if (!clerkUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    const metadata = clerkUser.publicMetadata as { role?: string; isAdmin?: boolean };
    const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const email = clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (metadata.role !== "admin" && metadata.isAdmin !== true && (!email || !configuredEmails.includes(email))) {
      res.status(403).json({ error: "Administrator access required" });
      return;
    }
    next();
  } catch (error) {
    logger.error({ error }, "Unable to resolve administrator access");
    res.status(401).json({ error: "Authentication required" });
  }
};
