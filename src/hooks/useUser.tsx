import useSWR from "swr";

const userFetcher = async () => {
  console.log("Fetching user data...");
  const response = await fetch("/user", {
    method: "GET",
    credentials: "include",
  });
  if (!response.ok) {
    let error: Error;
    if (response.status === 401) {
      error = new Error("Unauthorized");
    } else {
      error = new Error("An error occurred while fetching the user data.");
    }
    throw error;
  }

  return response.json();
};

export default function useUser(): Record<string, any> {
  console.log("useUser hook called");
  const { data, mutate, error } = useSWR("api_user", userFetcher, {
    refreshInterval: 20000,
  });

  const loading = !data && !error;
  const loggedOut = error && error.message === "Unauthorized";

  return {
    loading,
    loggedOut,
    user: data,
    mutate,
  };
}
