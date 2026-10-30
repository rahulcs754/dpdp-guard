import { PrismaClient } from "@prisma/client";
import { signupSchema } from "../../../lib/schemas";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const data = signupSchema.parse(await req.json());
  console.log("new signup", data.contact, data.mobile);
  const user = await prisma.user.create({
    data: { email: data.contact, phone: data.mobile, fullName: data.fullName, dob: data.dob },
  });
  console.log(user);
  return Response.json({ id: user.id });
}

export async function DELETE(req: Request) {
  const { orderId } = await req.json();
  await prisma.order.delete({ where: { id: orderId } });
  return new Response(null, { status: 204 });
}
