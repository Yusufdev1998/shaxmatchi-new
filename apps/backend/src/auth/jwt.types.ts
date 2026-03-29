export type JwtUserPayload = {
  sub: string;
  login: string;
  type: "student" | "teacher";
};

