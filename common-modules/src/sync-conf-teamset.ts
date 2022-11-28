import {Command} from 'commander'
import logger from "./logger"

import {getOrgTeams, getTeamsCatalog, createTeamSet, removeTeamSet} from "./teams"
import {TEAM_SET} from "./constants"

const trim = (value) => value.trim();
const syncTeamsSet = async () => {
    if (process.env.NODE_ENV === 'CI') {
        logger.level = "info";
    }
    console.debug(`Starting syncTeamsSet`);
    const program = new Command();
    program.requiredOption('-o, --org-name <type>', 'Organization name', trim)
    program.option('-e, --team-everyone-slug <type>', 'Team "Everyone" slug', trim)
    program.option('-d, --dryRun', 'Team "Everyone" slug')
    program.parse(process.argv);
    const options = program.opts();
    const {orgName, dryRun} = options;
    if (orgName) {
        const teams = await getOrgTeams(options.orgName);
        const teamEveryoneSlug: string = options.teamEveryoneSlug;
        const teamsCatalog = await getTeamsCatalog(options.orgName);
        
        logger.info(`GH list of teams: ${JSON.stringify(teams)}`);
        logger.info(`Catalog list of teams: ${JSON.stringify(teamsCatalog)}`);
        
        logger.info(`Total teams configured ${teams.length}`);
        logger.info(`Total in team catalog ${teamsCatalog.length}`);
        if (dryRun) {
            logger.info(`Dry run! Current catalog:\n${JSON.stringify(teamsCatalog, null,2)}`);
        } else {
            let teamsDelta = teamsCatalog.filter(catalogItem => !teams.find((teamsItem) => {
                return teamsItem['namePrefix'] === catalogItem.namePrefix
            }));
            logger.info(`Showing delta. Total ${teamsDelta.length}`);
            await Promise.all(teamsDelta.map(team => {
                console.debug(`teamsDelta: ${JSON.stringify(teamsDelta)}`)
                return createTeamSet({
                    org: orgName,
                    maintainers: team.maintainers,
                    teamPrefix: team.namePrefix,
                    employeesTeamSlug: teamEveryoneSlug
                })
            }))
            teamsDelta.forEach(team => console.log(`${JSON.stringify(team)}`))
        }
    }
};

export {syncTeamsSet}
const run = async () => {
    try {
        await syncTeamsSet();
        console.info("Success.")
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
run()
