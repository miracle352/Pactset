export type FormState = {
  status: "idle" | "success" | "error";
  message: string;
  fields?: Record<string, string>;
  entityId?: string;
};

export const initialFormState: FormState = { status: "idle", message: "" };

export function formFields(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}
