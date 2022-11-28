#!/usr/bin/env bash
usage() {
	echo "Create repo under this org"
	echo
	echo "Usage: $PROGNAME [options]..."
	echo
	echo "Options:"
	echo
	echo "  -h, --help"
	echo "      This help text."
	echo
	echo "  -r , --repo <repo name in the form of org/repo >"
	echo
	echo "  -o , --owner <GitHub Owner ID such as Jane-Doe_ghub>"
	echo
	echo "  -g , --owner-org <GitHub Org ID such as BY-Product-Development>"
	echo
	echo "  -t , --token <GitHub Dev token>"
	echo
	echo "  -s , --create-team-set <Create team set from the prefix>"
	echo
	echo "  -d , --team-description-prefix <The prefix of the team description>"
	echo
	echo "  -v , --verbose <Run in verbose mode>"
	echo
	echo "  --"
	echo "      Do not interpret any more arguments as options."
	echo
}
VERBOSiTY="-sS"
while [ "$#" -gt 0 ]
do
	case "$1" in
	-h|--help)
		usage
		exit 0
		;;
	-r|--repo)
		REPO_NAME="$2"
		;;
	-d|--team-description-prefix)
		TEAM_PREFIX="$2"
		;;
	-o|--owner)
		REQUESTOR_USER="$2"
		;;
	-g|--organization)
		ORG="$2"
		;;
	-t|--token)
		TOKEN="$2"
		;;
	-s|--team-slug-prefix)
		CREATE_TEAMSET=true
		;;
	-v|--verbose)
		VERBOSiTY="-v"
		;;
	--)
		break
		;;
	-*)
		echo "Invalid option '$1'. Use --help to see the valid options" >&2
		exit 1
		;;
	# an option argument, continue
	*)	;;
	esac
	shift
done

github_cmd(){
    local TOKEN=$1
    local URL=$2
    local PAYLOAD=$3
    if [[ -z ${PAYLOAD} ]]
    then
       RESULT=$(curl ${VERBOSiTY} -H "Authorization: token ${TOKEN}" $URL)
    else
       RESULT=$(curl ${VERBOSiTY} -H "Authorization: token ${TOKEN}" -d "$PAYLOAD"  $URL)
    fi
    echo ${RESULT}

}

github_post_cmd(){
    local TOKEN=$1
    local URL=$2
    local PAYLOAD=$3
    if [[ -z ${PAYLOAD} ]]
    then
       RESULT=$(curl ${VERBOSiTY} -X POST -H "Authorization: token ${TOKEN}" $URL)
    else
       RESULT=$(curl ${VERBOSiTY} -X POST -H "Accept: application/vnd.github.luke-cage-preview+json" -H "Authorization: token ${TOKEN}" -d "$PAYLOAD"  $URL)
    fi
    echo ${RESULT}
}

github_update_cmd(){
    local TOKEN=$1
    local URL=$2
    local PAYLOAD=$3
    if [[ -z ${PAYLOAD} ]]
    then
       RESULT=$(curl ${VERBOSiTY} -X PUT -H "Authorization: token ${TOKEN}" $URL)
    else
       RESULT=$(curl ${VERBOSiTY} -X PUT -H "Accept: application/vnd.github.luke-cage-preview+json" -H "Authorization: token ${TOKEN}" -d "$PAYLOAD"  $URL)
    fi
    echo ${RESULT}
}

github_delete_cmd(){
    local TOKEN=$1
    local URL=$2
    local PAYLOAD=$3
    if [[ -z ${PAYLOAD} ]]
    then
       RESULT=$(curl ${VERBOSiTY} -X DELETE -H "Authorization: token ${TOKEN}" $URL)
    else
       RESULT=$(curl ${VERBOSiTY} -X DELETE -H "Authorization: token ${TOKEN}" -d "$PAYLOAD" $URL)
    fi
    echo ${RESULT}
}


ADMIN_TEAM="$TEAM_PREFIX Admins"
TEAM_SLUG_PREFIX=$(echo $TEAM_PREFIX | sed  's/ /-/g;s/.*/\L&/g')
ADMIN_TEAM_SLUG_QRY="${TEAM_SLUG_PREFIX}-admins"
COLLABORATORS_TEAM="$TEAM_PREFIX Collaborators"
COLLABORATORS_TEAM_SLUG_QRY="${TEAM_SLUG_PREFIX}-collaborators"
CONTRIBUTORS_TEAM="$TEAM_PREFIX Contributors"
CONTRIBUTORS_TEAM_SLUG_QRY="${TEAM_SLUG_PREFIX}-contributors"
echo ADMIN_TEAM=$ADMIN_TEAM
echo COLLABORATORS_TEAM=$COLLABORATORS_TEAM
echo CONTRIBUTORS_TEAM=$CONTRIBUTORS_TEAM
echo TEAM_SLUG_PREFIX=$TEAM_SLUG_PREFIX
ORG="BY-Product-Development"
EMPLOYEES_TEAM="associates-pd"
PROXIED_USER=`github_cmd $TOKEN https://api.github.com/user | jq -r '.login'`
echo PROXIED_USER=$REQUESTOR_USER

echo REPO_NAME=$REPO_NAME

# Delete the repository
#    github_delete_cmd  $TOKEN https://api.github.com/repos/${ORG}/${REPO_NAME}


# Create repository
github_cmd $TOKEN https://api.github.com/orgs/${ORG}/repos '{"auto_init":true,"private":true,"name":"'"$REPO_NAME"'"}'
# Apply branch protection
REPO_ID=$(echo $RESULT | jq '.id')
if [[ "$REPO_ID" = "null" ]]
then
  >&2 echo "Repository ${REPO_NAME} already exists"
  return 1
fi

REPO_URL=$(echo $RESULT | jq -r '.html_url')
echo RESULT=$RESULT
echo REPO_ID=$REPO_ID

# Create teams
github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/everyone
EVERYONE_TEAM_ID=$(echo $RESULT | jq '.id')
github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/associates-pd
EMPLOYEES_TEAM_ID=$(echo $RESULT | jq '.id')
echo EVERYONE_TEAM_ID=$EVERYONE_TEAM_ID
echo EMPLOYEES_TEAM_ID=$EMPLOYEES_TEAM_ID
github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams

if [[ "$CREATE_TEAMSET" != true ]]
then
    github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${CONTRIBUTORS_TEAM_SLUG_QRY}
else
    github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams '{"name":"'"$CONTRIBUTORS_TEAM"'","parent_team_id":'$EVERYONE_TEAM_ID',"permission":"pull"}'
fi
CONTRIBUTORS_TEAM_ID=$(echo $RESULT | jq -r '.id | select (.!=null)')
CONTRIBUTORS_TEAM_SLUG="$(echo $RESULT | jq -r '.slug')"
if [[ -z ${CONTRIBUTORS_TEAM_ID} ]]
then
  echo "$TEAM_PREFIX" teamset not found. Please choose an approve teamset.
  exit 1;
fi

echo CONTRIBUTORS_TEAM_ID=$CONTRIBUTORS_TEAM_ID
echo CONTRIBUTORS_TEAM_SLUG="$CONTRIBUTORS_TEAM_SLUG"

if [[ "$CREATE_TEAMSET" != true ]]
then
    github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${COLLABORATORS_TEAM_SLUG_QRY}
else
    github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams '{"name":"'"$COLLABORATORS_TEAM"'","parent_team_id":'$CONTRIBUTORS_TEAM_ID',"permission":"pull"}'
fi
COLLABORATORS_TEAM_ID=$(echo $RESULT | jq '.id')
COLLABORATORS_TEAM_SLUG="$(echo $RESULT | jq -r '.slug')"
echo COLLABORATORS_TEAM_ID=$COLLABORATORS_TEAM_ID
echo COLLABORATORS_TEAM_SLUG="$COLLABORATORS_TEAM_SLUG"

if [[ "$CREATE_TEAMSET" != true ]]
then
    github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${ADMIN_TEAM_SLUG_QRY}
else
    github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams '{"name":"'"$ADMIN_TEAM"'","parent_team_id":'$COLLABORATORS_TEAM_ID',"permission":"pull"}'
fi
ADMIN_TEAM_ID=$(echo $RESULT | jq '.id')
ADMIN_TEAM_SLUG="$(echo $RESULT | jq -r '.slug')"
echo ADMIN_TEAM_ID=$ADMIN_TEAM_ID
echo ADMIN_TEAM_SLUG="$ADMIN_TEAM_SLUG"
# Make sure all employees can create pull requests
github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${EMPLOYEES_TEAM}/repos/${ORG}/${REPO_NAME} '{"permission":"triage"}'
github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${ADMIN_TEAM_SLUG}/repos/${ORG}/${REPO_NAME} '{"permission":"admin"}'
github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${COLLABORATORS_TEAM_SLUG}/repos/${ORG}/${REPO_NAME} '{"permission":"maintain"}'
github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${CONTRIBUTORS_TEAM_SLUG}/repos/${ORG}/${REPO_NAME} '{"permission":"push"}'


github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${EMPLOYEES_TEAM}/repositories/${REPO_NAME} '{"permission":"triage"}'
github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${ADMIN_TEAM_SLUG}/repositories/${REPO_NAME} '{"permission":"admin"}'
github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${COLLABORATORS_TEAM_SLUG}/repositories/${REPO_NAME} '{"permission":"maintain"}'
github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${CONTRIBUTORS_TEAM_SLUG}/repositories/${REPO_NAME} '{"permission":"push"}'


echo +++ Get currenrt protection +++
#github_cmd $TOKEN https://api.github.com/repos/${ORG}/${REPO_NAME}/branches/main/protection
github_update_cmd $TOKEN https://api.github.com/repos/${ORG}/${REPO_NAME}/branches/main/protection "{\"restrictions\":{\"teams\":[\"${COLLABORATORS_TEAM_SLUG}\"],\"users\":[]}, \"enforce_admins\":true,\"required_status_checks\":null,\"required_pull_request_reviews\":{\"dismiss_stale_reviews\":true,\"require_code_owner_reviews\":true,\"required_approving_review_count\":1,\"restrictions\":{\"users\":[],\"teams\":[\"${COLLABORATORS_TEAM_SLUG}\"]}}"
github_update_cmd $TOKEN https://api.github.com/repos/${ORG}/${REPO_NAME}/branches/main/protection/restrictions/teams "[\"${COLLABORATORS_TEAM_SLUG}\"]"



if [[ "$CREATE_TEAMSET" = true ]]
then
    # Make requester owner
    github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${ADMIN_TEAM_SLUG}/memberships/${REQUESTOR_USER} '{"role":"maintainer"}'
    github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${COLLABORATORS_TEAM_SLUG}/memberships/${REQUESTOR_USER} '{"role":"maintainer"}'
    github_update_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${CONTRIBUTORS_TEAM_SLUG}/memberships/${REQUESTOR_USER} '{"role":"maintainer"}'

    # Remove proxied user
    github_delete_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${ADMIN_TEAM_SLUG}/memberships/${PROXIED_USER}
    github_delete_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${COLLABORATORS_TEAM_SLUG}/memberships/${PROXIED_USER}
    github_delete_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${CONTRIBUTORS_TEAM_SLUG}/memberships/${PROXIED_USER}
fi
# Get maintainers
github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${CONTRIBUTORS_TEAM_SLUG_QRY}/members?role=maintainer
export CONTIRIBUTORS_MAINTAINERS=$(echo $(echo $RESULT | jq -r '.[] | .login' ) | tr ' ' ', ')
github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${COLLABORATORS_TEAM_SLUG_QRY}/members?role=maintainer
export COLLABORATORS_MAINTAINERS=$(echo $(echo $RESULT | jq -r '.[] | .login' ) | tr ' ' ', ')
github_cmd $TOKEN https://api.github.com/orgs/${ORG}/teams/${ADMIN_TEAM_SLUG_QRY}/members?role=maintainer
export ADMIN_MAINTAINERS=$(echo $(echo $RESULT | jq -r '.[] | .login' ) | tr ' ' ', ')
echo CONTIRIBUTORS_MAINTAINERS=$CONTIRIBUTORS_MAINTAINERS
echo COLLABORATORS_MAINTAINERS=$COLLABORATORS_MAINTAINERS
echo ADMIN_MAINTAINERS=$ADMIN_MAINTAINERS

export CREATE_REPO_RESULT=${REPO_URL}
echo -e "Repo URL is \n${REPO_URL}"
