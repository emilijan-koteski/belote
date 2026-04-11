package user

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func getTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := os.Getenv("BELOTE_DB_URL")
	if dsn == "" {
		dsn = "postgres://belote:belote_dev_password@localhost:5433/belote?sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skip("skipping integration test: database not available")
	}

	// Use a transaction that will be rolled back after the test
	tx := db.Begin()
	t.Cleanup(func() {
		tx.Rollback()
	})

	return tx
}

func TestGormUserRepository_Create(t *testing.T) {
	db := getTestDB(t)
	repo := NewGormUserRepository(db)

	u := &User{
		Email:              "create@test.com",
		Username:           "createuser",
		PasswordHash:       "hashedpassword",
		LanguagePreference: "en",
	}

	err := repo.Create(u)
	require.NoError(t, err)
	assert.NotZero(t, u.ID)
	assert.NotZero(t, u.CreatedAt)
}

func TestGormUserRepository_FindByEmail_Found(t *testing.T) {
	db := getTestDB(t)
	repo := NewGormUserRepository(db)

	u := &User{
		Email:              "find@test.com",
		Username:           "finduser",
		PasswordHash:       "hashedpassword",
		LanguagePreference: "en",
	}
	require.NoError(t, repo.Create(u))

	found, err := repo.FindByEmail("find@test.com")
	require.NoError(t, err)
	assert.Equal(t, u.ID, found.ID)
	assert.Equal(t, "find@test.com", found.Email)
}

func TestGormUserRepository_FindByEmail_NotFound(t *testing.T) {
	db := getTestDB(t)
	repo := NewGormUserRepository(db)

	found, err := repo.FindByEmail("nonexistent@test.com")
	assert.NoError(t, err)
	assert.Nil(t, found)
}

func TestGormUserRepository_FindByUsername_Found(t *testing.T) {
	db := getTestDB(t)
	repo := NewGormUserRepository(db)

	u := &User{
		Email:              "username@test.com",
		Username:           "findbyname",
		PasswordHash:       "hashedpassword",
		LanguagePreference: "en",
	}
	require.NoError(t, repo.Create(u))

	found, err := repo.FindByUsername("findbyname")
	require.NoError(t, err)
	assert.Equal(t, u.ID, found.ID)
	assert.Equal(t, "findbyname", found.Username)
}

func TestGormUserRepository_FindByUsername_NotFound(t *testing.T) {
	db := getTestDB(t)
	repo := NewGormUserRepository(db)

	found, err := repo.FindByUsername("nonexistent")
	assert.NoError(t, err)
	assert.Nil(t, found)
}
