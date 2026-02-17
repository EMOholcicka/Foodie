import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dayQueryKeys } from "../../days/api/daysApi";
import { getTargets, putTargets, type Targets, type TargetsPutRequest } from "./targetsApi";

export function targetsQueryKey() {
  return ["targets"] as const;
}

export function useTargetsQuery() {
  return useQuery({
    queryKey: targetsQueryKey(),
    queryFn: getTargets,
    retry: false,
  });
}

export function usePutTargetsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TargetsPutRequest) => putTargets(payload),
    onSuccess: async (data: Targets) => {
      qc.setQueryData(targetsQueryKey(), data);
      // Refresh any day-derived UI (Today/Day) that depends on targets for recomputation.
      await Promise.all([
        qc.invalidateQueries({ queryKey: targetsQueryKey() }),
        qc.invalidateQueries({ queryKey: dayQueryKeys.root }),
      ]);
    },
  });
}
