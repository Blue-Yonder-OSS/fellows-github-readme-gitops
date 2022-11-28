export const PRODUCT_NAME_REGEX = /(?<segment>[a-zA-Z]+)\-(?<product>[a-zA-Z]+)\-(?<component>.*)/;
export const TEAM_SLUG_NAME_REGEX = /^(?<slugPrefix>[a-zA-Z\-]+)\-(?<slugSuffix>.+)$/;
export const TEAM_NAME_REGEX = /^(?<namePrefix>[a-zA-Z\- ]+) (?<nameSuffix>.+)$/;
export const DEFAULT_REPOS_FILE_PATH = "../../conf/repos.json";
export const DEFAULT_TEAMS_FILE_PATH = "../../conf/teams.json";
export const DEFAULT_SECRETS_FILE_PATH = "../../conf/team-secrets.json";
export const DEFAULT_SECRETS_TEAMS_FILE_PATH = "../../conf/secrets";

export enum TEAM_SET {
    Admins = "Admins",
    Collaborators="Collaborators",
    Contributors="Contributors"
}
