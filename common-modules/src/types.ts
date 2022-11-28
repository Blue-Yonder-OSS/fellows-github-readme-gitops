import {
    GetResponseTypeFromEndpointMethod
} from "@octokit/types";
import { Octokit } from "@octokit/rest";
const octokit = new Octokit();

export type GetReposForOrgResponse = GetResponseTypeFromEndpointMethod<
    typeof octokit.paginate
    >;
export type GetRepoResponse = GetResponseTypeFromEndpointMethod<
    typeof octokit.repos.get
    >;
export type GetTeamResponse = GetResponseTypeFromEndpointMethod<
    typeof octokit.teams.getByName
    >;


export interface CuratedRepoParameters {
    name: string;
    org: string;
    description?: string;
    teams: {
        admins: string;
        collaborators: string;
        contributors: string;
    };
}

export interface CuratedTeamParameters {
    name: string;
    org: string;
    description?: string;
    orgSecretNames?: string[],
    maintainers?: string[] | undefined;
    parent_team_id?: number;
}

export interface CatalogTeamSet {
    namePrefix: string,
    maintainers: string[]
}

export enum GitHubTeamPostfix {
    ADMINS = "Admins",
    COLLABORATORS = "Collaborators",
    CONTRIBUTORS = "Contributors",
}
